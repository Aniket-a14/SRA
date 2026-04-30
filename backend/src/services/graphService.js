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

        const agent = new BaseAgent("Graph Extractor", "gemini-flash-latest");
        const prompt = GRAPH_EXTRACTION_PROMPT.replace("{{text}}", text);

        const graphData = await agent.callLLM(prompt, 0.2, true);

        if (graphData && graphData.nodes && graphData.edges) {
            await storeGraph(graphData, projectId, prismaClient);
        }

    } catch (error) {
        logger.error({ msg: "Graph Extraction Failed", error: error.message });
    }
};

export const storeGraph = async (graphData, projectId, prismaClient = prisma) => {
    try {
        await prismaClient.$transaction(async (tx) => {
            const nodeMap = new Map(); // Name -> ID mapping

            // Batch: Fetch all existing nodes for this project in one query
            const existingNodes = await tx.graphNode.findMany({
                where: { projectId },
                select: { id: true, name: true, type: true }
            });
            const existingNodeIndex = new Map(
                existingNodes.map(n => [`${n.name}::${n.type}`, n.id])
            );

            // Separate new vs existing nodes
            const newNodes = [];
            for (const node of graphData.nodes) {
                const key = `${node.name}::${node.type}`;
                const existingId = existingNodeIndex.get(key);
                if (existingId) {
                    nodeMap.set(node.name, existingId);
                } else {
                    newNodes.push({
                        projectId,
                        name: node.name,
                        type: node.type,
                        metadata: node.metadata || {}
                    });
                }
            }

            // Batch create new nodes
            if (newNodes.length > 0) {
                await tx.graphNode.createMany({ data: newNodes, skipDuplicates: true });

                // Fetch back the newly created nodes to get their IDs
                const created = await tx.graphNode.findMany({
                    where: { projectId, name: { in: newNodes.map(n => n.name) } },
                    select: { id: true, name: true }
                });
                created.forEach(n => nodeMap.set(n.name, n.id));
            }

            // Batch: Fetch existing edges for involved nodes in one query
            const allNodeIds = Array.from(nodeMap.values());
            const existingEdges = allNodeIds.length > 0 ? await tx.graphEdge.findMany({
                where: { sourceId: { in: allNodeIds }, targetId: { in: allNodeIds } },
                select: { sourceId: true, targetId: true, relation: true }
            }) : [];
            const edgeIndex = new Set(
                existingEdges.map(e => `${e.sourceId}::${e.targetId}::${e.relation}`)
            );

            // Collect new edges (deduplicated)
            const newEdges = [];
            for (const edge of graphData.edges) {
                const sourceId = nodeMap.get(edge.source);
                const targetId = nodeMap.get(edge.target);
                if (sourceId && targetId) {
                    const key = `${sourceId}::${targetId}::${edge.relation}`;
                    if (!edgeIndex.has(key)) {
                        newEdges.push({ sourceId, targetId, relation: edge.relation, metadata: edge.metadata || {} });
                        edgeIndex.add(key);
                    }
                }
            }

            // Batch create new edges
            if (newEdges.length > 0) {
                await tx.graphEdge.createMany({ data: newEdges, skipDuplicates: true });
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

export const getFullProjectGraph = async (projectId, userId = null) => {
    try {
        if (userId) {
            const project = await prisma.project.findFirst({
                where: {
                    id: projectId,
                    userId
                },
                select: { id: true }
            });

            if (!project) {
                const error = new Error('Project not found or unauthorized');
                error.statusCode = 404;
                throw error;
            }
        }

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
