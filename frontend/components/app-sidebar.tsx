"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    FileText,
    ShieldCheck,
    Bot,
    Sparkles,
    Database,
    Lock,
    MessageSquare,
    Plus,
    Folder,
    Settings,
    LogOut,
} from "lucide-react"
import { useLayer } from "@/lib/layer-context"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import useSWR from "swr"
import { fetcher, swrOptions } from "@/lib/swr-utils"
import { useMemo } from "react"

type AppSidebarProps = React.HTMLAttributes<HTMLDivElement>

interface AnalysisHistoryItem {
    id: string
    createdAt: string
    inputPreview: string
    title?: string
}

interface ProjectSummary {
    id: string
    name: string
}

const layers = [
    { id: 1, label: "Structured Input", icon: FileText },
    { id: 2, label: "Validation Gate", icon: ShieldCheck },
    { id: 3, label: "Final Analysis", icon: Bot },
    { id: 4, label: "Refinement", icon: Sparkles },
    { id: 5, label: "Knowledge Base", icon: Database },
] as const

function getInitials(name: string) {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
}

export function AppSidebar({ className }: AppSidebarProps) {
    const { currentLayer, setLayer, isLayerLocked, maxAllowedLayer, isFinalized } = useLayer()
    const router = useRouter()
    const params = useParams()
    const { token, user, logout } = useAuth()

    const analysisId = params?.id as string | undefined

    // Live conversation/analysis history rail. useSWR keeps it in sync (revalidates
    // on reconnect/interval like every other data fetch in this app).
    const swrKey = useMemo(() => {
        if (!token) return null
        return [`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze`, token] as const
    }, [token])

    const { data: historyData } = useSWR<AnalysisHistoryItem[]>(swrKey, fetcher, {
        ...swrOptions,
        refreshInterval: 30000,
    })

    const history = Array.isArray(historyData) ? historyData : []

    const projectsSwrKey = useMemo(() => {
        if (!token) return null
        return [`${process.env.NEXT_PUBLIC_BACKEND_URL}/projects`, token] as const
    }, [token])
    const { data: projectsData } = useSWR<ProjectSummary[]>(projectsSwrKey, fetcher, swrOptions)
    const projects = Array.isArray(projectsData) ? projectsData : []

    const handleLogout = () => {
        logout()
    }

    return (
        <div className={cn("w-64 border-r border-foreground/10 h-screen bg-background flex flex-col fixed left-0 top-0 z-30", className)}>
            <div className="px-4 py-4 border-b border-foreground/10">
                <Link href="/" className="flex items-center gap-2 mb-4">
                    <span className="text-xl font-display">SRA</span>
                    <span className="text-[10px] text-muted-foreground font-mono mt-1">IEEE-830</span>
                </Link>
                <Button
                    variant="outline"
                    className="w-full justify-start gap-2 rounded-full border-foreground/20 hover:bg-foreground/5"
                    onClick={() => router.push("/analysis/new")}
                >
                    <Plus className="h-4 w-4" />
                    New analysis
                </Button>
            </div>

            <ScrollArea className="flex-1">
                {/* Pipeline progress — only inside an in-flight analysis */}
                {analysisId && (
                    <div className="px-4 py-4 border-b border-foreground/10">
                        <h2 className="mb-3 text-xs font-mono uppercase tracking-wide text-muted-foreground">
                            Pipeline progress
                        </h2>
                        <div className="space-y-1">
                            {layers.map((layer) => {
                                const Icon = layer.icon
                                const isLocked = isLayerLocked(layer.id as 1 | 2 | 3 | 4 | 5)
                                const isActive = currentLayer === layer.id
                                const isDone = layer.id < maxAllowedLayer || (layer.id === 5 && isFinalized)

                                return (
                                    <button
                                        key={layer.id}
                                        type="button"
                                        disabled={isLocked}
                                        onClick={() => !isLocked && setLayer(layer.id as 1 | 2 | 3 | 4 | 5)}
                                        className={cn(
                                            "w-full flex items-center gap-2 px-2 py-2 text-sm text-left transition-colors",
                                            isLocked && "opacity-40 cursor-not-allowed",
                                            isActive ? "bg-foreground text-background" : "hover:bg-foreground/5"
                                        )}
                                    >
                                        <span className={cn(
                                            "h-1.5 w-1.5 rounded-full shrink-0",
                                            isActive ? "bg-background" : isDone ? "bg-foreground" : "bg-foreground/20"
                                        )} />
                                        <Icon className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">{layer.label}</span>
                                        {isLocked && <Lock className="ml-auto h-3 w-3 opacity-50 shrink-0" />}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Projects */}
                <div className="px-4 py-4 border-b border-foreground/10">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-xs font-mono uppercase tracking-wide text-muted-foreground">
                            Projects
                        </h2>
                        <button
                            className="text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => router.push("/projects")}
                        >
                            View all
                        </button>
                    </div>
                    <div className="space-y-1">
                        {projects.length === 0 && (
                            <p className="text-xs text-muted-foreground/60 px-2 py-1">No projects yet</p>
                        )}
                        {projects.slice(0, 5).map((project) => (
                            <button
                                key={project.id}
                                type="button"
                                onClick={() => router.push(`/projects/${project.id}`)}
                                className="w-full flex items-center gap-2 px-2 py-2 text-sm text-left truncate text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                            >
                                <Folder className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{project.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Recent analyses */}
                <div className="px-4 py-4">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-xs font-mono uppercase tracking-wide text-muted-foreground">
                            Recent analyses
                        </h2>
                        <button
                            className="text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => router.push("/analysis")}
                        >
                            View all
                        </button>
                    </div>
                    <div className="space-y-1">
                        {history.length === 0 && (
                            <p className="text-xs text-muted-foreground/60 px-2 py-1">No analyses yet</p>
                        )}
                        {history.slice(0, 15).map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => router.push(`/analysis/${item.id}`)}
                                className={cn(
                                    "w-full flex items-center gap-2 px-2 py-2 text-sm text-left truncate transition-colors",
                                    item.id === analysisId ? "bg-foreground/5 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                                )}
                            >
                                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{item.title || item.inputPreview || "Untitled"}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </ScrollArea>

            {/* User menu */}
            <div className="border-t border-foreground/10 p-3">
                {user && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="w-full flex items-center gap-2 px-2 py-2 hover:bg-foreground/5 transition-colors" aria-label="User menu">
                                <Avatar className="h-7 w-7">
                                    <AvatarImage src={user.image} alt={user.name} />
                                    <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm truncate">{user.name}</span>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56" align="start">
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none">{user.name}</p>
                                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => router.push("/projects")}>
                                <Folder className="mr-2 h-4 w-4" />
                                Projects
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push("/settings")}>
                                <Settings className="mr-2 h-4 w-4" />
                                Settings
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                                <LogOut className="mr-2 h-4 w-4" />
                                Log out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </div>
    )
}
