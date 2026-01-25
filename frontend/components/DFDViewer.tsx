"use client"

import React, { useCallback, useEffect } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Edge,
    MarkerType,
    Handle,
    Position,
    NodeProps,
    Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// -----------------------------------------------------------------------------
// 0. SHARED TYPES
// -----------------------------------------------------------------------------

interface DFDNodeData extends Record<string, unknown> {
    label: string;
}

type DFDNodeType = Node<DFDNodeData>;

// -----------------------------------------------------------------------------
// 1. CUSTOM NODE COMPONENTS
// -----------------------------------------------------------------------------

// Process Node: Circular, Vibrant, Modern - DARKER for visibility
const ProcessNode = ({ data }: NodeProps<DFDNodeType>) => {
    return (
        <div className="flex flex-col items-center justify-center p-2 rounded-full bg-blue-100 border-[3px] border-blue-600 shadow-lg w-[130px] h-[130px] hover:shadow-xl transition-all duration-300 group">
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-blue-600 border-2 border-white" />
            <Handle type="target" position={Position.Left} className="w-3 h-3 bg-blue-600 border-2 border-white" />

            <div className="text-center text-sm font-extrabold text-blue-950 leading-tight px-1 group-hover:scale-105 transition-transform">
                {data.label}
            </div>

            <Handle type="source" position={Position.Right} className="w-3 h-3 bg-blue-600 border-2 border-white" />
            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-blue-600 border-2 border-white" />
        </div>
    );
};

// External Entity Node: Solid, Authoritative, Rectangular - BOLDER
const ExternalEntityNode = ({ data }: NodeProps<DFDNodeType>) => {
    return (
        <div className="flex flex-col items-center justify-center px-4 py-3 rounded-lg bg-white border-[3px] border-slate-900 shadow-md min-w-[140px] hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-900 border-2 border-white" />
            <Handle type="target" position={Position.Left} className="w-3 h-3 bg-slate-900 border-2 border-white" />

            <div className="text-center font-bold text-black uppercase text-xs tracking-widest">
                {data.label}
            </div>

            <Handle type="source" position={Position.Right} className="w-3 h-3 bg-slate-900 border-2 border-white" />
            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-900 border-2 border-white" />
        </div>
    );
};

// Data Store Node: Open-ended style - DARKER
const DataStoreNode = ({ data }: NodeProps<DFDNodeType>) => {
    return (
        <div className="relative flex items-center justify-center px-6 py-4 min-w-[160px] bg-emerald-100 border-t-[3px] border-b-[3px] border-emerald-700 shadow-sm hover:bg-emerald-200 transition-colors">
            {/* Left Cap Line */}
            <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-emerald-300 to-transparent pointer-events-none"></div>

            <div className="text-center text-sm font-bold text-emerald-950 tracking-wide">
                {data.label}
            </div>

            <Handle type="target" position={Position.Top} className="w-2 h-2 bg-emerald-700 opacity-0" />
            <Handle type="target" position={Position.Left} className="w-3 h-3 bg-emerald-700 border-2 border-white" />
            <Handle type="source" position={Position.Right} className="w-3 h-3 bg-emerald-700 border-2 border-white" />
            <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-emerald-700 opacity-0" />
        </div>
    );
};

const nodeTypes = {
    process: ProcessNode,
    external_entity: ExternalEntityNode,
    data_store: DataStoreNode,
};

// -----------------------------------------------------------------------------
// 2. TYPES & INTERFACES
// -----------------------------------------------------------------------------

type DFDNode = {
    id: string;
    type: 'process' | 'external_entity' | 'data_store';
    label: string;
};

type DFDFlow = {
    from: string;
    to: string;
    label: string;
};

type DFDLevel = {
    nodes: DFDNode[];
    flows: DFDFlow[];
};

export type DFDInput = {
    dfd_level_0?: DFDLevel;
    dfd_level_1?: DFDLevel;
};

// -----------------------------------------------------------------------------
// 3. HELPER: DATA MAPPING
// -----------------------------------------------------------------------------

const mapToReactFlow = (dfdData: DFDLevel | undefined) => {
    if (!dfdData) return { nodes: [], edges: [] };

    // Simple layout strategy: distribute in a grid or circle
    // Real apps might use 'dagre' or 'elkjs' for auto-layout.
    // We'll implemented a naive positioner for demonstration.
    const nodes = dfdData.nodes.map((node, index) => {
        // Stagger positions to prevent overlap - Increased spacing
        const x = (index % 3) * 450 + 100;
        const y = Math.floor(index / 3) * 300 + 100;

        return {
            id: node.id,
            type: node.type, // Maps to nodeTypes keys
            position: { x, y },
            data: { label: node.label },
        };
    });

    const edges = dfdData.flows.map((flow, i) => ({
        id: `e-${i}-${flow.from}-${flow.to}`,
        source: flow.from,
        target: flow.to,
        label: flow.label,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#000000' }, // Black arrows
        style: { stroke: '#000000', strokeWidth: 2 }, // Thicker black strokes
        labelStyle: { fill: '#000000', fontWeight: 700, fontSize: 12, background: 'white' }, // Darker Text
        labelBgStyle: { fill: 'white', fillOpacity: 0.9 }
    }));

    return { nodes, edges };
};

// ...

const DiagramCanvas = ({ title, data, isExport = false }: { title: string; data: DFDLevel | undefined; isExport?: boolean }) => {
    const { nodes: initialNodes, edges: initialEdges } = mapToReactFlow(data);
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // Re-sync if prop data changes
    useEffect(() => {
        const { nodes: n, edges: e } = mapToReactFlow(data);
        setNodes(n);
        setEdges(e);
    }, [data, setNodes, setEdges]);

    if (!data) return null;

    return (
        <div className={`w-full border border-gray-200 rounded-lg overflow-hidden bg-white flex flex-col ${isExport ? 'min-h-[800px] border-0' : 'h-[400px] mb-8'}`}>
            {!isExport && (
                <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 font-bold text-gray-700">
                    {title}
                </div>
            )}
            <div className="flex-1 w-full h-full relative">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.2, duration: 0 }} // INSTANT FIT
                    attributionPosition="bottom-right"
                    minZoom={0.1}
                    maxZoom={2}
                >
                    <Background color="#aaa" gap={16} />
                    {!isExport && <Controls />}
                </ReactFlow>
            </div>
        </div>
    );
};

export const DFDViewer = ({ data, isExport = false }: { data: DFDInput; isExport?: boolean }) => {
    if (!data) return <div className="text-gray-500 italic">No DFD data available</div>;

    return (
        <div className={`w-full flex flex-col ${isExport ? 'h-full gap-0' : 'gap-8'}`}>
            {data.dfd_level_0 && (
                <DiagramCanvas title="DFD Level 0 (Context Diagram)" data={data.dfd_level_0} isExport={isExport} />
            )}
            {/* If exporting, we typically only render ONE canvas at a time in the loop. 
                But if rendering both, we need to handle layout. 
                For export-utils, we render them individually. */}
            {data.dfd_level_1 && (
                <DiagramCanvas title="DFD Level 1 (Decomposition)" data={data.dfd_level_1} isExport={isExport} />
            )}
        </div>
    );
};

export default DFDViewer;
