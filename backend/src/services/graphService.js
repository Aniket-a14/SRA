import prisma from '../config/prisma.js';
import { BaseAgent } from '../agents/BaseAgent.js';
import logger from '../config/logger.js';

// Graph Extraction Prompt
const GRAPH_EXTRACTION_PROMPT = `
<role>
You are an expert Systems Architect. Your goal is to extract a "Knowledge Graph" from the provided Software Requirements text.
</role>

<task>
Identify key technical entities (Nodes) and the relationships (Edges) between them based on the provided text.
</task>

<constraints>
[NODE TYPES]
1. ACTOR: Users, external systems, or roles (e.g., "Admin", "Stripe API").
2. SYSTEM: Modules, databases, components, or services (e.g., "Auth Service", "Postgres").
3. FEATURE: Specific functional requirements or capabilities (e.g., "Login", "Generate Report").
4. DATA_ENTITY: Core business objects (e.g., "User Profile", "Order", "Invoice").

[EDGE TYPES]
- USES: Actor uses a Feature.
- DEPENDS_ON: Feature depends on System/Feature.
- TRIGGERS: Action triggers another action.
- DATA_FLOW_TO: Data moves from A to B.
- UPDATES/READS: Interaction with Data Entity.

[NAMING RULES]
- Use concise, singular names (e.g., "User" not "Users").
- Avoid generic nodes like "System" or "Application".
</constraints>

<output_format>
Return strictly JSON matching this schema. No markdown wrappers.
{
  "nodes": [
    { "name": "Admin", "type": "ACTOR" },
    { "name": "Login", "type": "FEATURE" }
  ],
  "edges": [
    { "source": "Admin", "target": "Login", "relation": "USES" }
  ]
}
</output_format>

<input>
Input Text:
{{text}}
</input>
`;

export const extractGraph = async (text, projectId, prismaClient = prisma) => {
    try {
        if (!process.env.GEMINI_API_KEY) {
            logger.warn("Skipping Graph Extraction: No API Key.");
            return;
        }

        // BaseAgent's 2nd arg is a providerConfig object (Phase 4 multi-provider rework),
        // not a bare model-name string — this call site predates that change and was
        // silently falling back to the platform default Gemini model instead of this one.
        const agent = new BaseAgent("Graph Extractor", { provider: 'GEMINI', modelName: 'gemini-flash-latest' });
        const prompt = GRAPH_EXTRACTION_PROMPT.replace("{{text}}", text);

        const graphData = await agent.callLLM(prompt, 0.2, true);

        if (graphData && graphData.nodes && graphData.edges) {
            await storeGraph(graphData, projectId, prismaClient);
        }

    } catch (error) {
        logger.error({ msg: "Graph Extraction Failed", error: error.message });
    }
};

const nodeKey = (name, type) => `${name}::${type}`;
const edgeKey = (sourceId, targetId, relation) => `${sourceId}::${targetId}::${relation}`;

export const storeGraph = async (graphData, projectId, prismaClient = prisma) => {
    try {
        await prismaClient.$transaction(async (tx) => {
            const nodeMap = new Map(); // Name -> ID mapping

            // Batch: one findMany + one createManyAndReturn instead of a per-node
            // findUnique/create round-trip — the sequential version risked timing out
            // or lock-contending the transaction on larger graphs.
            const existingNodes = await tx.graphNode.findMany({ where: { projectId } });
            const existingNodeByKey = new Map(existingNodes.map(n => [nodeKey(n.name, n.type), n]));

            const nodesToCreateByKey = new Map(); // dedupe in case the LLM repeats a node within one payload
            for (const node of graphData.nodes) {
                const key = nodeKey(node.name, node.type);
                const existing = existingNodeByKey.get(key);
                if (existing) {
                    nodeMap.set(node.name, existing.id);
                } else if (!nodesToCreateByKey.has(key)) {
                    nodesToCreateByKey.set(key, node);
                }
            }

            if (nodesToCreateByKey.size > 0) {
                const created = await tx.graphNode.createManyAndReturn({
                    data: Array.from(nodesToCreateByKey.values()).map(node => ({
                        projectId,
                        name: node.name,
                        type: node.type,
                        metadata: node.metadata || {}
                    }))
                });
                created.forEach(dbNode => nodeMap.set(dbNode.name, dbNode.id));
            }

            // Same batching for edges: one findMany scoped to this graph's node IDs,
            // diff in memory, one createMany.
            const nodeIds = Array.from(nodeMap.values());
            const existingEdges = nodeIds.length > 0
                ? await tx.graphEdge.findMany({ where: { sourceId: { in: nodeIds } } })
                : [];
            const existingEdgeKeys = new Set(existingEdges.map(e => edgeKey(e.sourceId, e.targetId, e.relation)));

            const edgesToCreateByKey = new Map();
            for (const edge of graphData.edges) {
                const sourceId = nodeMap.get(edge.source);
                const targetId = nodeMap.get(edge.target);
                if (!sourceId || !targetId) continue;

                const key = edgeKey(sourceId, targetId, edge.relation);
                if (existingEdgeKeys.has(key) || edgesToCreateByKey.has(key)) continue;

                edgesToCreateByKey.set(key, {
                    sourceId,
                    targetId,
                    relation: edge.relation,
                    metadata: edge.metadata || {}
                });
            }

            if (edgesToCreateByKey.size > 0) {
                await tx.graphEdge.createMany({ data: Array.from(edgesToCreateByKey.values()) });
            }
        }, { timeout: 15000 });
        logger.info(`[GraphService] Stored ${graphData.nodes.length} nodes and ${graphData.edges.length} edges for Project ${projectId}`);

    } catch (error) {
        logger.error({ msg: "Graph Storage Failed", error: error.message });
    }
};

/**
 * Traverses the graph to find connected entities.
 * Returns a text summary of neighbors for RAG context.
 */
export const traverseGraph = async (nodeNames, projectId, depth, prismaClient = prisma) => {
    if (!nodeNames || nodeNames.length === 0) return "";

    try {
        // 1. Find start nodes
        const nodes = await prismaClient.graphNode.findMany({
            where: {
                projectId,
                name: { in: nodeNames }
            }
        });

        if (nodes.length === 0) return "";

        const nodeIds = nodes.map(n => n.id);

        // 2. Find outgoing edges (Dependency chaser)
        // For depth=1, we just look at immediate neighbors
        const edges = await prismaClient.graphEdge.findMany({
            where: {
                sourceId: { in: nodeIds }
            },
            include: {
                target: true,
                source: true
            }
        });

        // Format as context
        if (edges.length === 0) return "";

        let context = "\n[GRAPH_KNOWLEDGE_CONTEXT]\n";
        context += "Known system dependencies:\n";

        edges.forEach(edge => {
            context += `- ${edge.source.name} --[${edge.relation}]--> ${edge.target.name}\n`;
        });

        return context;
    } catch (error) {
        logger.error({ msg: "Graph Traversal Failed", error: error.message });
        return "";
    }
}

export const getFullProjectGraph = async (projectId) => {
    try {
        const nodes = await prisma.graphNode.findMany({
            where: { projectId }
        });

        const nodeIds = nodes.map(n => n.id);

        const edges = await prisma.graphEdge.findMany({
            where: {
                sourceId: { in: nodeIds }
            },
            include: {
                source: { select: { name: true, type: true } },
                target: { select: { name: true, type: true } }
            }
        });

        return { nodes, edges };
    } catch (error) {
        logger.error({ msg: "Error fetching project graph", error: error.message });
        throw error;
    }
};
