"use client"

import React, { useCallback, useEffect, useState, memo } from "react"
import {
    ReactFlow,
    Background,
    Controls,
    useNodesState,
    useEdgesState,
    MarkerType,
    NodeProps,
    Position,
    ReactFlowProvider,
    useReactFlow,
    Panel,
    Handle,
    Node,
    Edge
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import dagre from "@dagrejs/dagre"
import { motion } from "framer-motion"
import { User, Server, Star, Database, Maximize2, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuthFetch } from "@/lib/hooks"
import { toast } from "sonner"

// --- Custom Nodes ---

interface BaseNodeProps {
    title: string;
    icon: React.ElementType;
    colorClass: string;
    type: string;
}

const BaseNode = ({ title, icon: Icon, colorClass, type }: BaseNodeProps) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ y: -5, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
        className={`flex flex-col items-center justify-center p-3 rounded-xl bg-white border-2 ${colorClass} min-w-[140px] shadow-sm relative group`}
    >
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-white ${colorClass.replace('border-', 'bg-')}`}>
            {type}
        </div>
        <Handle type="target" position={Position.Top} className="!bg-slate-300" />
        <div className="flex flex-col items-center gap-2">
            <Icon className={`h-4 w-4 ${colorClass.replace('border-', 'text-')}`} />
            <div className="text-[11px] font-bold text-slate-800 text-center leading-tight">
                {title}
            </div>
        </div>
        <Handle type="source" position={Position.Bottom} className="!bg-slate-300" />
    </motion.div>
)

const ActorNode = ({ data }: NodeProps) => (
    <BaseNode title={data.label as string} icon={User} colorClass="border-emerald-500" type="Actor" />
)

const SystemNode = ({ data }: NodeProps) => (
    <BaseNode title={data.label as string} icon={Server} colorClass="border-blue-500" type="System" />
)

const FeatureNode = ({ data }: NodeProps) => (
    <BaseNode title={data.label as string} icon={Star} colorClass="border-purple-500" type="Feature" />
)

const DataEntityNode = ({ data }: NodeProps) => (
    <BaseNode title={data.label as string} icon={Database} colorClass="border-orange-500" type="Data" />
)

const nodeTypes = {
    ACTOR: ActorNode,
    SYSTEM: SystemNode,
    FEATURE: FeatureNode,
    DATA_ENTITY: DataEntityNode,
}

// --- Layout Logic ---

interface RFNode {
    id: string;
    type: string;
    data: { label: string };
    position: { x: number; y: number };
}

interface RFEdge {
    id: string;
    source: string;
    target: string;
    label?: string;
    type?: string;
    markerEnd?: { type: MarkerType; color?: string } | string;
    style?: React.CSSProperties;
    labelStyle?: React.CSSProperties;
    animated?: boolean;
}

const getLayoutedElements = (nodes: RFNode[], edges: RFEdge[], direction = "TB") => {
    const dagreGraph = new dagre.graphlib.Graph()
    dagreGraph.setDefaultEdgeLabel(() => ({}))
    dagreGraph.setGraph({ rankdir: direction, nodesep: 70, ranksep: 100 })

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: 150, height: 80 })
    })

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target)
    })

    dagre.layout(dagreGraph)

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id)
        return {
            ...node,
            position: {
                x: nodeWithPosition.x - 75,
                y: nodeWithPosition.y - 40,
            },
        }
    })

    return { nodes: layoutedNodes, edges }
}

// --- Inner Component ---

interface GraphNode {
    id: string;
    name: string;
    type: 'ACTOR' | 'SYSTEM' | 'FEATURE' | 'DATA_ENTITY';
}

interface GraphEdge {
    sourceId: string;
    targetId: string;
    relation: string;
}

const KnowledgeGraphCanvas = ({ projectId }: { projectId: string }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
    const [loading, setLoading] = useState(true)
    const { fitView } = useReactFlow()
    const authFetch = useAuthFetch()

    const fetchGraph = useCallback(async () => {
        setLoading(true)
        try {
            const res = await authFetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/projects/${projectId}/graph`)
            if (!res.ok) throw new Error("Failed to fetch graph data")
            const data = { nodes: [] as GraphNode[], edges: [] as GraphEdge[] }
            const result = await res.json()
            data.nodes = result.nodes || []
            data.edges = result.edges || []

            const rfNodes = data.nodes.map((n: GraphNode) => ({
                id: n.id,
                type: n.type,
                data: { label: n.name },
                position: { x: 0, y: 0 },
            }))

            const rfEdges = data.edges.map((e: GraphEdge, i: number) => ({
                id: `e-${i}`,
                source: e.sourceId,
                target: e.targetId,
                label: e.relation,
                type: "smoothstep",
                markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
                style: { stroke: "#cbd5e1", strokeWidth: 1.5 },
                labelStyle: { fontSize: 9, fill: "#64748b", fontWeight: 600 },
                animated: true,
            }))

            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(rfNodes, rfEdges)
            setNodes(layoutedNodes)
            setEdges(layoutedEdges)

            setTimeout(() => fitView({ padding: 0.2 }), 100)
        } catch (error) {
            console.error(error)
            toast.error("Failed to load Knowledge Graph")
        } finally {
            setLoading(false)
        }
    }, [projectId, authFetch, setNodes, setEdges, fitView])

    useEffect(() => {
        fetchGraph()
    }, [fetchGraph])

    return (
        <div className="h-[600px] w-full bg-slate-50/50 rounded-xl border border-slate-200 overflow-hidden relative">
            {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-3">
                        <RefreshCw className="h-8 w-8 text-primary animate-spin" />
                        <p className="text-sm font-medium text-slate-500">Mapping Architecture...</p>
                    </div>
                </div>
            )}

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                nodesConnectable={false}
            >
                <Background color="#cbd5e1" gap={20} />
                <Controls />
                <Panel position="top-right" className="bg-white/90 p-2 rounded-lg border shadow-sm flex gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => fetchGraph()}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => fitView({ padding: 0.2 })}>
                        <Maximize2 className="h-4 w-4" />
                    </Button>
                </Panel>
            </ReactFlow>
        </div>
    )
}

// --- Exported Tab ---

export const KnowledgeGraphTab = memo(function KnowledgeGraphTab({ projectId }: { projectId: string }) {
    if (!projectId) return <div className="p-12 text-center text-slate-400 italic">No project associated with this analysis.</div>

    return (
        <div className="space-y-6 animate-fade-in outline-none">
            <Card className="border-none shadow-none bg-transparent">
                <CardHeader className="px-0">
                    <CardTitle className="text-xl font-semibold flex items-center gap-2">
                        Knowledge Graph
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-widest font-bold">Experimental</span>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        Visualizing the relationships between system entities, actors, and functional requirements.
                    </p>
                </CardHeader>
                <CardContent className="px-0">
                    <ReactFlowProvider>
                        <KnowledgeGraphCanvas projectId={projectId} />
                    </ReactFlowProvider>
                </CardContent>
            </Card>
        </div>
    )
})
