import prisma from '../config/prisma.js';
import { BaseAgent } from '../agents/BaseAgent.js';

// Graph Extraction Prompt
const GRAPH_EXTRACTION_PROMPT = `
You are an expert Systems Architect. Your goal is to extract a "Knowledge Graph" from the provided Software Requirements text.

Identify the following entities (Nodes):
1.  **ACTOR**: Users, external systems, or roles (e.g., "Admin", "Stripe API").
2.  **SYSTEM**: Modules, databases, components, or services (e.g., "Auth Service", "Postgres").
3.  **FEATURE**: Specific functional requirements or capabilities (e.g., "Login", "Generate Report").
4.  **DATA_ENTITY**: core business objects (e.g., "User Profile", "Order", "Invoice").

Identify relationships (Edges) between them:
-   **USES**: Actor uses a Feature.
-   **DEPENDS_ON**: Feature depends on System/Feature.
-   **TRIGGERS**: Action triggers another action.
-   **DATA_FLOW_TO**: Data moves from A to B.
-   **UPDATES/READS**: Interaction with Data Entity.

Output strictly JSON in this format:
{
  "nodes": [
    { "name": "Admin", "type": "ACTOR" },
    { "name": "Login", "type": "FEATURE" }
  ],
  "edges": [
    { "source": "Admin", "target": "Login", "relation": "USES" }
  ]
}

-   Use concise, singular names (e.g., "User" not "Users").
-   Avoid generic nodes like "System" or "Application".
`;

export const extractGraph = async (text, projectId, prismaClient = prisma) => {
    try {
        if (!process.env.GEMINI_API_KEY) {
            console.warn("Skipping Graph Extraction: No API Key.");
            return;
        }

        const agent = new BaseAgent("Graph Extractor", "gemini-flash-latest");
        const prompt = `${GRAPH_EXTRACTION_PROMPT}\n\nInput Text:\n${text}`;

        const graphData = await agent.callLLM(prompt, 0.2, true);

        if (graphData && graphData.nodes && graphData.edges) {
            await storeGraph(graphData, projectId, prismaClient);
        }

    } catch (error) {
        console.error("Graph Extraction Failed:", error);
    }
};

export const storeGraph = async (graphData, projectId, prismaClient = prisma) => {
    try {
        await prismaClient.$transaction(async (tx) => {
            const nodeMap = new Map(); // Name -> ID mapping

            // Upsert Nodes
            for (const node of graphData.nodes) {
                let dbNode = await tx.graphNode.findUnique({
                    where: {
                        projectId_name_type: {
                            projectId,
                            name: node.name,
                            type: node.type
                        }
                    }
                });

                if (!dbNode) {
                    dbNode = await tx.graphNode.create({
                        data: {
                            projectId,
                            name: node.name,
                            type: node.type,
                            metadata: node.metadata || {}
                        }
                    });
                }
                nodeMap.set(node.name, dbNode.id);
            }

            // Create Edges
            for (const edge of graphData.edges) {
                const sourceId = nodeMap.get(edge.source);
                const targetId = nodeMap.get(edge.target);

                if (sourceId && targetId) {
                    // Avoid duplicate edges
                    const existingEdge = await tx.graphEdge.findFirst({
                        where: {
                            sourceId,
                            targetId,
                            relation: edge.relation
                        }
                    });

                    if (!existingEdge) {
                        await tx.graphEdge.create({
                            data: {
                                sourceId,
                                targetId,
                                relation: edge.relation,
                                metadata: edge.metadata || {}
                            }
                        });
                    }
                }
            }
        }, { timeout: 15000 });
        console.log(`[GraphService] Stored ${graphData.nodes.length} nodes and ${graphData.edges.length} edges for Project ${projectId}`);

    } catch (error) {
        console.error("Graph Storage Failed:", error);
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
        console.error("Graph Traversal Failed:", error);
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
        console.error("Error fetching project graph:", error);
        throw error;
    }
};
