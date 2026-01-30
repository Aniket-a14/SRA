import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const dagre = require('@dagrejs/dagre');

/**
 * Layouts DFD nodes using Dagre in the backend.
 * Converts Dagre center positions to React Flow top-left positions.
 * 
 * @param {Object} dfdLevel - Object with { nodes, flows }
 * @param {string} direction - 'LR' (horizontal) or 'TB' (vertical)
 * @returns {Object} Layouted DFD level
 */
export function layoutDFDLevel(dfdLevel, direction = 'LR') {
    if (!dfdLevel || !dfdLevel.nodes || !dfdLevel.flows) return dfdLevel;

    const g = new dagre.graphlib.Graph();
    g.setGraph({
        rankdir: direction,
        nodesep: 120, // Moderate spacing
        ranksep: 180,
        marginx: 80,
        marginy: 80
    });
    g.setDefaultEdgeLabel(() => ({}));

    // Balanced dimensions for nodes
    const nodeWidth = 240;
    const nodeHeight = 160;

    dfdLevel.nodes.forEach((node) => {
        g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    dfdLevel.flows.forEach((flow) => {
        g.setEdge(flow.from, flow.to);
    });

    dagre.layout(g);

    const layoutedNodes = dfdLevel.nodes.map((node) => {
        const pos = g.node(node.id);
        return {
            ...node,
            position: {
                x: pos.x - nodeWidth / 2, // Convert center to top-left
                y: pos.y - nodeHeight / 2,
            },
        };
    });

    return {
        ...dfdLevel,
        nodes: layoutedNodes,
    };
}

/**
 * Layouts all levels in a DFD input.
 * 
 * @param {Object} dfdInput - { dfd_level_0, dfd_level_1 }
 * @returns {Object} Layouted DFD input
 */
export function layoutAllDFD(dfdInput) {
    const result = { ...dfdInput };

    if (result.dfd_level_0) {
        result.dfd_level_0 = layoutDFDLevel(result.dfd_level_0, 'LR');
    }

    if (result.dfd_level_1) {
        result.dfd_level_1 = layoutDFDLevel(result.dfd_level_1, 'TB');
    }

    return result;
}
