"use client"

import React, { useRef } from 'react';
import { Layers, Download } from 'lucide-react';
import { toPng } from 'html-to-image';
import { Button } from '@/components/ui/button';
import {
    ReactFlow,
    Background,
    Controls,
    useNodesState,
    useEdgesState,
    MarkerType,
    NodeProps,
    Node,
    Edge,
    Handle,
    Position,
    ReactFlowProvider,
    useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
// import * as dagre from '@dagrejs/dagre'; // Removed top-level import to avoid require error

// -----------------------------------------------------------------------------
// 0. SHARED TYPES
// -----------------------------------------------------------------------------

interface DFDNodeData extends Record<string, unknown> {
    label: string;
}

type DFDNodeType = Node<DFDNodeData>;

// -----------------------------------------------------------------------------
import { motion } from 'framer-motion';

// ... (keep nodeTypes as is)

// Process Node: Gane-Sarson Style (Rounded corners, thick borders)
const ProcessNode = ({ data }: NodeProps<DFDNodeType>) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 20 }}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white border-[2.5px] border-blue-600 shadow-sm w-[140px] h-[140px] hover:shadow-blue-200/50 hover:shadow-2xl transition-all duration-300 group relative"
        >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-[10px] text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">
                Process
            </div>

            <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-blue-600 !border-white" />
            <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-blue-600 !border-white" />

            <div className="text-center text-xs font-bold text-slate-900 leading-tight px-1 group-hover:scale-110 transition-transform">
                {data.label}
            </div>

            <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-blue-600 !border-white" />
            <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-blue-600 !border-white" />
        </motion.div>
    );
};

// External Entity Node: Professional, Solid, Square
const ExternalEntityNode = ({ data }: NodeProps<DFDNodeType>) => {
    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ y: -5 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center px-5 py-4 rounded-md bg-slate-900 border-[2px] border-slate-900 shadow-md min-w-[150px] hover:bg-slate-800 transition-all duration-300 relative"
        >
            <div className="absolute -top-2.5 left-4 bg-slate-400 text-[9px] text-white px-1.5 py-0.5 rounded font-black uppercase italic">
                External
            </div>

            <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-slate-400 !border-slate-900" />
            <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-slate-400 !border-slate-900" />

            <div className="text-center font-black text-white uppercase text-[11px] tracking-widest leading-none">
                {data.label}
            </div>

            <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-slate-400 !border-slate-900" />
            <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-slate-400 !border-slate-900" />
        </motion.div>
    );
};

// Data Store Node: Open-ended Parallel Lines
const DataStoreNode = ({ data }: NodeProps<DFDNodeType>) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ boxShadow: "0 10px 25px -5px rgba(16, 185, 129, 0.2)" }}
            className="relative flex items-center justify-center px-8 py-5 min-w-[180px] bg-emerald-50 border-y-[3px] border-emerald-600 shadow-sm hover:bg-emerald-100 transition-colors group"
        >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-600"></div>

            <div className="text-center text-[11px] font-black text-emerald-900 uppercase tracking-wider">
                {data.label}
            </div>

            <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-emerald-600 !border-white" />
            <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-emerald-600 !border-white" />
        </motion.div>
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
    position?: { x: number; y: number };
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

// -----------------------------------------------------------------------------
// 3. HELPER: DATA MAPPING & LAYOUT (DAGRE)
// -----------------------------------------------------------------------------

// (mapToReactFlow removed because it's replaced by DiagramCanvas logic or was unused)

interface DiagramCanvasProps {
    title: string;
    data: DFDLevel | undefined;
    isExport?: boolean;
}

const DiagramCanvas = ({ title, data, isExport = false }: DiagramCanvasProps) => {
    const [nodes, setNodes, onNodesChange] = useNodesState<DFDNodeType>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const containerRef = useRef<HTMLDivElement>(null);
    const { fitView } = useReactFlow();

    React.useEffect(() => {
        if (!data) return;

        const initialNodes = data.nodes.map((node: DFDNode) => ({
            id: node.id,
            type: node.type,
            data: { label: node.label },
            position: node.position || { x: 0, y: 0 },
            targetPosition: Position.Left,
            sourcePosition: Position.Right,
        }));

        const initialEdges = data.flows.map((flow, i) => ({
            id: `e-${i}-${flow.from}-${flow.to}`,
            source: flow.from,
            target: flow.to,
            label: flow.label,
            type: 'smoothstep',
            animated: true,
            markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#334155',
                width: 20,
                height: 20
            },
            style: { stroke: '#64748b', strokeWidth: 2.5 },
            labelStyle: { fill: '#0f172a', fontWeight: 800, fontSize: 10 },
            labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.9, rx: 4 }
        }));

        setNodes(initialNodes);
        setEdges(initialEdges);

        // Optional: fitView after a short delay to ensure rendering is complete
        const timer = setTimeout(() => {
            fitView({ padding: 0.2 });
        }, 100);
        return () => clearTimeout(timer);
    }, [data, setNodes, setEdges, fitView]);

    const exportToImage = async () => {
        if (!containerRef.current) return;

        try {
            const dataUrl = await toPng(containerRef.current, {
                backgroundColor: '#ffffff',
                quality: 1,
                pixelRatio: 2, // Retína quality
            });

            const link = document.createElement('a');
            link.download = `sra-dfd-${title.toLowerCase().replace(/\s+/g, '-')}.png`;
            link.href = dataUrl;
            link.click();
            // toast.success("Image exported successfully!");
        } catch (err) {
            console.error("Export failed:", err);
            // toast.error("Failed to export image");
        }
    };

    if (!data) return null;

    return (
        <div className={`w-full border border-slate-200 bg-white rounded-xl overflow-hidden flex flex-col transition-all duration-500 shadow-sm ${isExport ? 'min-h-[800px] border-0' : 'h-[600px] mb-8'}`}>
            {!isExport && (
                <div className="px-6 py-4 border-b flex items-center justify-between transition-colors bg-slate-50 border-slate-200">
                    <span className="font-bold text-slate-800 tracking-tight">{title}</span>
                    <div className="flex items-center gap-3">
                        {!isExport && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={exportToImage}
                                className="h-7 gap-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all rounded-lg"
                            >
                                <Download className="h-3.5 w-3.5" />
                                <span className="text-[10px] font-bold uppercase tracking-tight">Export PNG</span>
                            </Button>
                        )}
                        <div className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all bg-blue-100 text-blue-700">
                            Interactive
                        </div>
                    </div>
                </div>
            )}
            <div ref={containerRef} className="flex-1 w-full h-full relative overflow-hidden bg-white">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.1 }}
                    attributionPosition="bottom-right"
                    minZoom={0.1}
                    maxZoom={2}
                    nodesConnectable={false}
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
        <div className={`w-full flex flex-col ${isExport ? 'h-full gap-0' : 'gap-8 px-4 py-6'}`}>
            {!isExport && (
                <div className="flex items-center justify-end mb-2">
                    <div className="text-[10px] text-slate-400 font-medium uppercase tracking-[0.2em] flex items-center gap-2 mr-2">
                        <Layers className="h-3 w-3" />
                        Analysis Fidelity
                    </div>
                </div>
            )}

            {data.dfd_level_0 && (
                <ReactFlowProvider>
                    <DiagramCanvas
                        title="DFD Level 0 (Context Diagram)"
                        data={data.dfd_level_0}
                        isExport={isExport}
                    />
                </ReactFlowProvider>
            )}
            {data.dfd_level_1 && (
                <ReactFlowProvider>
                    <DiagramCanvas
                        title="DFD Level 1 (Decomposition)"
                        data={data.dfd_level_1}
                        isExport={isExport}
                    />
                </ReactFlowProvider>
            )}
        </div>
    );
};

export default DFDViewer;
