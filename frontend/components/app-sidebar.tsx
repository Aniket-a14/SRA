"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    LayoutDashboard,
    FileText,
    ShieldCheck,
    Bot,
    Sparkles,
    Database,
    Lock,
    Folder
} from "lucide-react"
import { useLayer } from "@/lib/layer-context"
import { useRouter, usePathname, useParams } from "next/navigation"
import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"

type AppSidebarProps = React.HTMLAttributes<HTMLDivElement>

export function AppSidebar({ className }: AppSidebarProps) {
    const { currentLayer, setLayer, isLayerLocked, maxAllowedLayer, isFinalized } = useLayer()
    const router = useRouter()
    const pathname = usePathname()
    const params = useParams()
    const { token } = useAuth()
    const [projects, setProjects] = useState<{ id: string, name: string }[]>([])

    const analysisId = params?.id

    // Fetch projects for sidebar list
    useEffect(() => {
        if (token) {
            fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/projects`, {
                headers: { Authorization: `Bearer ${token}` }
            })
                .then(res => {
                    if (!res.ok) throw new Error("Failed");
                    return res.json();
                })
                .then(data => {
                    if (Array.isArray(data)) {
                        setProjects(data);
                    } else {
                        setProjects([]);
                    }
                })
                .catch(err => {
                    console.error("Failed to load projects", err);
                    setProjects([]);
                })
        }
    }, [token])

    const layers = [
        { id: 1, label: "Structured Input", icon: FileText },
        { id: 2, label: "Validation Gate", icon: ShieldCheck },
        { id: 3, label: "Final Analysis", icon: Bot },
        { id: 4, label: "Refinement", icon: Sparkles },
        { id: 5, label: "Knowledge Base", icon: Database },
    ] as const

    return (
        <div className={cn("pb-12 w-64 border-r h-screen bg-muted/10 flex flex-col fixed left-0 top-0 z-30", className)}>
            <div className="space-y-4 py-4">

                {/* Layer Tracker - Only show if inside an analysis */}
                {analysisId && (
                    <div className="px-3 py-2">
                        <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
                            Pipeline Progress
                        </h2>
                        <div className="space-y-1">
                            {layers.map((layer) => {
                                const Icon = layer.icon
                                const isLocked = isLayerLocked(layer.id as 1 | 2 | 3 | 4 | 5)
                                const isActive = currentLayer === layer.id

                                return (
                                    <Button
                                        key={layer.id}
                                        variant={isActive ? "secondary" : "ghost"}
                                        className={cn(
                                            "w-full justify-start relative pl-8",
                                            isLocked && "opacity-50 cursor-not-allowed",
                                            isActive && "bg-primary/10 text-primary hover:bg-primary/15"
                                        )}
                                        disabled={isLocked}
                                        onClick={() => !isLocked && setLayer(layer.id as 1 | 2 | 3 | 4 | 5)}
                                    >
                                        {/* Connector Line */}
                                        <div className="absolute left-4 top-0 bottom-0 w-px bg-border group-last:bottom-1/2"></div>

                                        {/* Status Dot */}
                                        <div className={cn(
                                            "absolute left-[13px] h-2.5 w-2.5 rounded-full border border-background z-10",
                                            isActive ? "bg-primary" :
                                                (layer.id < maxAllowedLayer || (layer.id === 5 && isFinalized)) ? "bg-green-500" : "bg-muted-foreground/30"
                                        )} />

                                        <Icon className="mr-2 h-4 w-4" />
                                        {layer.label}
                                        {isLocked && <Lock className="ml-auto h-3 w-3 opacity-50" />}
                                    </Button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Recent Projects List */}
                <div className="py-2">
                    <h2 className="relative px-7 text-xs font-semibold tracking-tight text-muted-foreground/70 uppercase mb-2">
                        Recent Projects
                    </h2>
                    <ScrollArea className="h-[200px] px-1">
                        <div className="space-y-1 p-2">
                            {projects.slice(0, 5).map((p) => (
                                <Button
                                    key={p.id}
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start font-normal truncate"
                                    onClick={() => router.push(`/projects/${p.id}`)}
                                >
                                    <Folder className="mr-2 h-3 w-3" />
                                    <span className="truncate">{p.name}</span>
                                </Button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            </div>

            {/* Footer / User Info could go here */}
        </div>
    )
}
