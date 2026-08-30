"use client"

import React, { useCallback, useEffect, useState, useMemo, memo } from "react"
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
    Handle,
    Node,
    Edge
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import dagre from "@dagrejs/dagre"
import { motion, AnimatePresence } from "framer-motion"
import {
    User,
    Server,
    Star,
    Database,
    Maximize2,
    RefreshCw,
    Search,
    ArrowRight,
    ArrowLeft,
    X,
    Layers,
    Info
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useAuthFetch } from "@/lib/hooks"
import { toast } from "sonner"
import { DIAGRAM_EDGE_THEME } from "@/lib/diagram-theme"

// --- Custom Nodes ---

interface BaseNodeProps {
    title: string;
    icon: React.ElementType;
    colorClass: string;
    type: string;
    selected?: boolean;
}

const BaseNode = ({ title, icon: Icon, colorClass, type, selected }: BaseNodeProps) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ y: -4, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
        className={`flex flex-col items-center justify-center p-3 rounded-xl bg-white border-2 ${colorClass} min-w-[140px] shadow-sm relative group cursor-pointer transition-all ${
            selected ? "ring-4 ring-primary/20 shadow-md scale-105" : ""
        }`}
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

const ActorNode = ({ data, selected }: NodeProps) => (
    <BaseNode title={data.label as string} icon={User} colorClass="border-emerald-500" type="Actor" selected={selected} />
)

const SystemNode = ({ data, selected }: NodeProps) => (
    <BaseNode title={data.label as string} icon={Server} colorClass="border-blue-500" type="System" selected={selected} />
)

const FeatureNode = ({ data, selected }: NodeProps) => (
    <BaseNode title={data.label as string} icon={Star} colorClass="border-purple-500" type="Feature" selected={selected} />
)

const DataEntityNode = ({ data, selected }: NodeProps) => (
    <BaseNode title={data.label as string} icon={Database} colorClass="border-orange-500" type="Data" selected={selected} />
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
    data: { label: string; rawType?: string };
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
        dagreGraph.setNode(node.id, { width: 160, height: 85 })
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
                x: nodeWithPosition ? nodeWithPosition.x - 80 : 0,
                y: nodeWithPosition ? nodeWithPosition.y - 42 : 0,
            },
        }
    })

    return { nodes: layoutedNodes, edges }
}

// --- Types ---

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
    const [rawNodes, setRawNodes] = useState<GraphNode[]>([])
    const [rawEdges, setRawEdges] = useState<GraphEdge[]>([])
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
    const [loading, setLoading] = useState(true)
    const [selectedType, setSelectedType] = useState<string>("ALL")
    const [searchQuery, setSearchQuery] = useState<string>("")
    const [layoutDir, setLayoutDir] = useState<"TB" | "LR">("TB")
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

    const { fitView } = useReactFlow()
    const authFetch = useAuthFetch()

    const fetchGraph = useCallback(async () => {
        setLoading(true)
        try {
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || ""
            const res = await authFetch(`${backendUrl}/projects/${projectId}/graph`)
            if (!res.ok) throw new Error("Failed to fetch graph data")
            const result = await res.json()
            const graphData = result.data || result
            const fetchedNodes: GraphNode[] = graphData.nodes || []
            const fetchedEdges: GraphEdge[] = graphData.edges || []

            setRawNodes(fetchedNodes)
            setRawEdges(fetchedEdges)
        } catch (error) {
            console.error(error)
            toast.error("Failed to load Knowledge Graph")
        } finally {
            setLoading(false)
        }
    }, [projectId, authFetch])

    useEffect(() => {
        Promise.resolve().then(() => fetchGraph())
    }, [fetchGraph])

    // Recompute graph elements when raw data, filter, search, or layout direction changes
    useEffect(() => {
        if (rawNodes.length === 0) {
            setNodes([])
            setEdges([])
            return
        }

        // 1. Filter Nodes
        const filteredNodes = rawNodes.filter(n => {
            const matchesType = selectedType === "ALL" || n.type === selectedType
            const matchesSearch = !searchQuery.trim() || n.name.toLowerCase().includes(searchQuery.toLowerCase())
            return matchesType && matchesSearch
        })

        const activeNodeIds = new Set(filteredNodes.map(n => n.id))

        // 2. Filter Edges (keep edges where both endpoints are visible)
        const filteredEdges = rawEdges.filter(e => activeNodeIds.has(e.sourceId) && activeNodeIds.has(e.targetId))

        const rfNodes: RFNode[] = filteredNodes.map(n => ({
            id: n.id,
            type: n.type,
            data: { label: n.name, rawType: n.type },
            position: { x: 0, y: 0 },
        }))

        const rfEdges: RFEdge[] = filteredEdges.map((e, i) => {
            const isConnectedToSelected = selectedNodeId && (e.sourceId === selectedNodeId || e.targetId === selectedNodeId)
            return {
                id: `e-${i}`,
                source: e.sourceId,
                target: e.targetId,
                label: e.relation,
                type: "smoothstep",
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: isConnectedToSelected ? "#6366f1" : DIAGRAM_EDGE_THEME.edgeStroke
                },
                style: {
                    stroke: isConnectedToSelected ? "#6366f1" : DIAGRAM_EDGE_THEME.edgeStrokeLight,
                    strokeWidth: isConnectedToSelected ? 2.5 : 1.5
                },
                labelStyle: {
                    fontSize: 9,
                    fill: isConnectedToSelected ? "#4f46e5" : DIAGRAM_EDGE_THEME.edgeStroke,
                    fontWeight: 600
                },
                animated: Boolean(isConnectedToSelected),
            }
        })

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(rfNodes, rfEdges, layoutDir)
        setNodes(layoutedNodes)
        setEdges(layoutedEdges)

        setTimeout(() => fitView({ padding: 0.2 }), 80)
    }, [rawNodes, rawEdges, selectedType, searchQuery, layoutDir, selectedNodeId, setNodes, setEdges, fitView])

    // Node inspection details
    const selectedNodeDetails = useMemo(() => {
        if (!selectedNodeId) return null
        const node = rawNodes.find(n => n.id === selectedNodeId)
        if (!node) return null

        const outgoing = rawEdges
            .filter(e => e.sourceId === selectedNodeId)
            .map(e => ({
                relation: e.relation,
                target: rawNodes.find(n => n.id === e.targetId)?.name || e.targetId
            }))

        const incoming = rawEdges
            .filter(e => e.targetId === selectedNodeId)
            .map(e => ({
                relation: e.relation,
                source: rawNodes.find(n => n.id === e.sourceId)?.name || e.sourceId
            }))

        return {
            ...node,
            outgoing,
            incoming
        }
    }, [selectedNodeId, rawNodes, rawEdges])

    const handleNodeClick = (_: React.MouseEvent, node: Node) => {
        setSelectedNodeId(node.id)
    }

    const typeCounts = useMemo(() => {
        const counts: Record<string, number> = { ALL: rawNodes.length }
        rawNodes.forEach(n => {
            counts[n.type] = (counts[n.type] || 0) + 1
        })
        return counts
    }, [rawNodes])

    return (
        <div className="h-[650px] w-full bg-slate-50/60 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden relative flex flex-col">
            {/* Top Toolbar */}
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-b p-3 flex flex-wrap items-center justify-between gap-3 z-10">
                {/* Search */}
                <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-xs">
                    <div className="relative w-full">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Search nodes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-8 pl-8 text-xs bg-slate-50 dark:bg-slate-800"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto">
                    {[
                        { id: "ALL", label: "All", count: typeCounts.ALL || 0 },
                        { id: "ACTOR", label: "Actors", count: typeCounts.ACTOR || 0, color: "text-emerald-700 bg-emerald-500/10" },
                        { id: "SYSTEM", label: "Systems", count: typeCounts.SYSTEM || 0, color: "text-blue-700 bg-blue-500/10" },
                        { id: "FEATURE", label: "Features", count: typeCounts.FEATURE || 0, color: "text-purple-700 bg-purple-500/10" },
                        { id: "DATA_ENTITY", label: "Data", count: typeCounts.DATA_ENTITY || 0, color: "text-orange-700 bg-orange-500/10" },
                    ].map(f => (
                        <button
                            key={f.id}
                            onClick={() => setSelectedType(f.id)}
                            className={`px-2.5 py-1 rounded-full text-xs font-mono transition-all flex items-center gap-1.5 ${
                                selectedType === f.id
                                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                            }`}
                        >
                            <span>{f.label}</span>
                            <span className="text-[10px] opacity-75">({f.count})</span>
                        </button>
                    ))}
                </div>

                {/* Layout & Reset Controls */}
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLayoutDir(prev => prev === "TB" ? "LR" : "TB")}
                        className="h-8 text-xs font-mono gap-1"
                        title="Switch layout direction"
                    >
                        <Layers className="h-3.5 w-3.5" />
                        {layoutDir === "TB" ? "Vertical" : "Horizontal"}
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => fetchGraph()}
                        disabled={loading}
                        title="Reload Graph"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => fitView({ padding: 0.2 })}
                        title="Fit View"
                    >
                        <Maximize2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Canvas Area */}
            <div className="flex-1 relative">
                {loading && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-3">
                            <RefreshCw className="h-8 w-8 text-primary animate-spin" />
                            <p className="text-sm font-medium text-slate-500 font-mono">Mapping Architecture...</p>
                        </div>
                    </div>
                )}

                {rawNodes.length === 0 && !loading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-900/20">
                        <Info className="h-10 w-10 text-muted-foreground/40 mb-3" />
                        <h3 className="text-base font-semibold text-foreground">No Architecture Nodes Indexed</h3>
                        <p className="text-xs text-muted-foreground max-w-sm mt-1">
                            Finalize an analysis under this project to automatically extract and map system entities, actors, and functional relations.
                        </p>
                    </div>
                ) : (
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onNodeClick={handleNodeClick}
                        nodeTypes={nodeTypes}
                        fitView
                        nodesConnectable={false}
                    >
                        <Background color={DIAGRAM_EDGE_THEME.gridDot} gap={20} />
                        <Controls />
                    </ReactFlow>
                )}

                {/* Node Details Overlay Panel */}
                <AnimatePresence>
                    {selectedNodeDetails && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="absolute right-3 top-3 w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl border shadow-lg p-4 z-30 space-y-3"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <Badge variant="outline" className="text-[10px] font-mono uppercase mb-1">
                                        {selectedNodeDetails.type}
                                    </Badge>
                                    <h4 className="font-semibold text-sm leading-snug">{selectedNodeDetails.name}</h4>
                                </div>
                                <button
                                    onClick={() => setSelectedNodeId(null)}
                                    className="text-muted-foreground hover:text-foreground p-1 rounded-md"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Outgoing Relations */}
                            <div className="space-y-1.5 pt-1">
                                <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider flex items-center gap-1">
                                    <ArrowRight className="h-3 w-3 text-primary" />
                                    Outgoing ({selectedNodeDetails.outgoing.length})
                                </span>
                                {selectedNodeDetails.outgoing.length === 0 ? (
                                    <p className="text-[11px] text-muted-foreground italic pl-2">No outgoing connections</p>
                                ) : (
                                    <div className="space-y-1 max-h-24 overflow-y-auto">
                                        {selectedNodeDetails.outgoing.map((rel, i) => (
                                            <div key={i} className="text-xs p-1.5 rounded bg-muted/40 flex items-center justify-between">
                                                <span className="font-mono text-[10px] text-primary">{rel.relation}</span>
                                                <span className="font-medium truncate max-w-[120px]">{rel.target}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Incoming Relations */}
                            <div className="space-y-1.5 pt-1">
                                <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider flex items-center gap-1">
                                    <ArrowLeft className="h-3 w-3 text-emerald-500" />
                                    Incoming ({selectedNodeDetails.incoming.length})
                                </span>
                                {selectedNodeDetails.incoming.length === 0 ? (
                                    <p className="text-[11px] text-muted-foreground italic pl-2">No incoming connections</p>
                                ) : (
                                    <div className="space-y-1 max-h-24 overflow-y-auto">
                                        {selectedNodeDetails.incoming.map((rel, i) => (
                                            <div key={i} className="text-xs p-1.5 rounded bg-muted/40 flex items-center justify-between">
                                                <span className="font-medium truncate max-w-[120px]">{rel.source}</span>
                                                <span className="font-mono text-[10px] text-emerald-600">{rel.relation}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}

// --- Exported Tab ---

export const KnowledgeGraphTab = memo(function KnowledgeGraphTab({ projectId }: { projectId: string }) {
    if (!projectId) return <div className="p-12 text-center text-slate-400 italic">No project associated with this analysis.</div>

    return (
        <div className="space-y-6 outline-none">
            <Card className="border-none shadow-none bg-transparent">
                <CardHeader className="px-0">
                    <CardTitle className="text-xl font-semibold flex items-center gap-2">
                        Knowledge Graph
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-widest font-bold">Interactive</span>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        Explore interconnected architectural actors, system components, functional requirements, and data entities.
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
