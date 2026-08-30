"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useAuthFetch } from "@/lib/hooks"
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command"
import {
    FileText,
    Folder,
    Plus,
    Activity,
    Settings,
    Database,
    Sparkles,
    BookOpen,
    ArrowRight
} from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface SearchAnalysisResult {
    id: string
    title: string
    version: number
    status: string
    resultQuality: string
    createdAt: string
    projectId: string | null
    projectName: string | null
    snippet: string
}

interface SearchProjectResult {
    id: string
    name: string
    description: string | null
    updatedAt: string
    analysisCount: number
}

interface SearchChunkResult {
    id: string
    type: string
    tags: string[]
    qualityScore: number | null
    sourceAnalysisId: string
}

interface SearchResponse {
    query: string
    total: number
    results: {
        analyses: SearchAnalysisResult[]
        projects: SearchProjectResult[]
        knowledgeChunks: SearchChunkResult[]
    }
}

interface CommandPaletteProps {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    onOpenActivityCenter?: () => void
}

export function CommandPalette({
    open: controlledOpen,
    onOpenChange: setControlledOpen,
    onOpenActivityCenter
}: CommandPaletteProps) {
    const [internalOpen, setInternalOpen] = React.useState(false)
    const open = controlledOpen !== undefined ? controlledOpen : internalOpen
    const setOpen = setControlledOpen || setInternalOpen

    const router = useRouter()
    const { token } = useAuth()
    const [query, setQuery] = React.useState("")
    const [isSearching, setIsSearching] = React.useState(false)
    const [searchResults, setSearchResults] = React.useState<SearchResponse["results"]>({
        analyses: [],
        projects: [],
        knowledgeChunks: []
    })

    // Keyboard shortcut handler (⌘K / Ctrl+K)
    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen(!open)
            }
        }
        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [open, setOpen])

    const authFetch = useAuthFetch()

    // Debounced search fetch with request cancellation and stale response prevention
    React.useEffect(() => {
        const trimmed = query.trim()
        if (!trimmed || !token) {
            return
        }

        const controller = new AbortController()
        const timer = setTimeout(async () => {
            setIsSearching(true)
            try {
                const res = await authFetch(
                    `${process.env.NEXT_PUBLIC_BACKEND_URL}/search?q=${encodeURIComponent(trimmed)}`,
                    { signal: controller.signal }
                )
                if (res.ok) {
                    const json = await res.json()
                    const data = json.data || json
                    if (data?.results) {
                        setSearchResults(data.results)
                    }
                }
            } catch (err: unknown) {
                if ((err as Error)?.name !== "AbortError") {
                    console.error("Failed to execute global search", err)
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsSearching(false)
                }
            }
        }, 200)

        return () => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [query, token, authFetch])

    // Immediately clear results when query becomes empty without triggering cascading renders
    const effectiveResults = React.useMemo(() => {
        if (!query.trim()) {
            return { analyses: [], projects: [], knowledgeChunks: [] }
        }
        return searchResults
    }, [query, searchResults])

    const handleSelect = (callback: () => void) => {
        setOpen(false)
        callback()
    }

    return (
        <CommandDialog
            open={open}
            onOpenChange={setOpen}
            title="Global Command Palette & Search"
            description="Search specifications, projects, and navigate the workspace"
        >
            <CommandInput
                placeholder="Type a command or search across specifications, projects..."
                value={query}
                onValueChange={setQuery}
            />
            <CommandList className="max-h-[380px] overflow-y-auto">
                <CommandEmpty>
                    {isSearching ? "Searching workspace..." : "No results found."}
                </CommandEmpty>

                {/* Live Search Results */}
                {effectiveResults.analyses.length > 0 && (
                    <CommandGroup heading="Specifications & Analyses">
                        {effectiveResults.analyses.map((analysis) => (
                            <CommandItem
                                key={`analysis-${analysis.id}`}
                                value={`analysis-${analysis.id}-${analysis.title}-${analysis.snippet}`}
                                onSelect={() => handleSelect(() => router.push(`/analysis/${analysis.id}`))}
                                className="flex items-center justify-between gap-2 py-2.5"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                                    <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-medium text-sm truncate">{analysis.title}</span>
                                            <Badge variant="outline" className="h-4 px-1 text-[10px]">
                                                v{analysis.version}
                                            </Badge>
                                            {analysis.projectName && (
                                                <span className="text-[10px] text-muted-foreground truncate">
                                                    in {analysis.projectName}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate max-w-md">
                                            {analysis.snippet}
                                        </p>
                                    </div>
                                </div>
                                <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-40" />
                            </CommandItem>
                        ))}
                    </CommandGroup>
                )}

                {effectiveResults.projects.length > 0 && (
                    <CommandGroup heading="Projects">
                        {effectiveResults.projects.map((project) => (
                            <CommandItem
                                key={`project-${project.id}`}
                                value={`project-${project.id}-${project.name}`}
                                onSelect={() => handleSelect(() => router.push(`/projects/${project.id}`))}
                                className="flex items-center justify-between gap-2 py-2"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <Folder className="h-4 w-4 shrink-0 text-amber-500" />
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-medium text-sm truncate">{project.name}</span>
                                        {project.description && (
                                            <p className="text-xs text-muted-foreground truncate">
                                                {project.description}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <Badge variant="secondary" className="text-[10px]">
                                    {project.analysisCount} {project.analysisCount === 1 ? "spec" : "specs"}
                                </Badge>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                )}

                {effectiveResults.knowledgeChunks.length > 0 && (
                    <CommandGroup heading="Knowledge Fragments">
                        {effectiveResults.knowledgeChunks.map((chunk) => (
                            <CommandItem
                                key={`chunk-${chunk.id}`}
                                value={`chunk-${chunk.id}-${chunk.type}-${chunk.tags.join(" ")}`}
                                onSelect={() => handleSelect(() => router.push(`/analysis/${chunk.sourceAnalysisId}`))}
                                className="flex items-center justify-between gap-2 py-2"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <Database className="h-4 w-4 shrink-0 text-indigo-500" />
                                    <span className="font-mono text-xs uppercase">{chunk.type}</span>
                                    <div className="flex items-center gap-1 overflow-hidden">
                                        {chunk.tags.slice(0, 3).map((tag, idx) => (
                                            <span key={idx} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                {chunk.qualityScore && (
                                    <span className="text-[10px] text-muted-foreground">
                                        Score: {Math.round(chunk.qualityScore * 100)}%
                                    </span>
                                )}
                            </CommandItem>
                        ))}
                    </CommandGroup>
                )}

                {(effectiveResults.analyses.length > 0 || effectiveResults.projects.length > 0) && (
                    <CommandSeparator />
                )}

                {/* Quick Actions */}
                <CommandGroup heading="Quick Actions">
                    <CommandItem
                        value="action-new-analysis"
                        onSelect={() => handleSelect(() => router.push("/analysis/new"))}
                    >
                        <Plus className="mr-2 h-4 w-4 text-primary" />
                        <span>Start New Requirements Analysis</span>
                    </CommandItem>
                    <CommandItem
                        value="action-activity-center"
                        onSelect={() => handleSelect(() => {
                            if (onOpenActivityCenter) {
                                onOpenActivityCenter()
                            } else {
                                router.push("/analysis")
                            }
                        })}
                    >
                        <Activity className="mr-2 h-4 w-4 text-emerald-500" />
                        <span>Open Task & Activity Center</span>
                    </CommandItem>
                    <CommandItem
                        value="action-view-projects"
                        onSelect={() => handleSelect(() => router.push("/projects"))}
                    >
                        <Folder className="mr-2 h-4 w-4 text-amber-500" />
                        <span>Manage Projects</span>
                    </CommandItem>
                    <CommandItem
                        value="action-all-analyses"
                        onSelect={() => handleSelect(() => router.push("/analysis"))}
                    >
                        <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>View All Analyses</span>
                    </CommandItem>
                    <CommandItem
                        value="action-ai-settings"
                        onSelect={() => handleSelect(() => router.push("/settings"))}
                    >
                        <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>AI Provider & BYOK Settings</span>
                    </CommandItem>
                    <CommandItem
                        value="action-documentation"
                        onSelect={() => handleSelect(() => router.push("/docs"))}
                    >
                        <BookOpen className="mr-2 h-4 w-4 text-indigo-500" />
                        <span>Browse Enterprise Documentation</span>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                {/* Documentation Pillars */}
                <CommandGroup heading="Documentation & Guides">
                    <CommandItem
                        value="docs-getting-started"
                        onSelect={() => handleSelect(() => router.push("/docs/getting-started"))}
                    >
                        <Sparkles className="mr-2 h-4 w-4 text-primary" />
                        <span>Docs: Getting Started & Fast-Track Quickstart</span>
                    </CommandItem>
                    <CommandItem
                        value="docs-pipeline"
                        onSelect={() => handleSelect(() => router.push("/docs/pipeline"))}
                    >
                        <Activity className="mr-2 h-4 w-4 text-emerald-500" />
                        <span>Docs: 5-Layer Multi-Agent AI Pipeline</span>
                    </CommandItem>
                    <CommandItem
                        value="docs-standards"
                        onSelect={() => handleSelect(() => router.push("/docs/standards"))}
                    >
                        <FileText className="mr-2 h-4 w-4 text-amber-500" />
                        <span>Docs: Standards (IEEE 830, ISO 29148, Volere, PRD)</span>
                    </CommandItem>
                    <CommandItem
                        value="docs-cli"
                        onSelect={() => handleSelect(() => router.push("/docs/cli"))}
                    >
                        <FileText className="mr-2 h-4 w-4 text-blue-500" />
                        <span>Docs: SRA CLI Toolkit (@sra-srs/sra-cli)</span>
                    </CommandItem>
                    <CommandItem
                        value="docs-api"
                        onSelect={() => handleSelect(() => router.push("/docs/api"))}
                    >
                        <Database className="mr-2 h-4 w-4 text-purple-500" />
                        <span>Docs: REST API Reference & Integration</span>
                    </CommandItem>
                    <CommandItem
                        value="docs-security"
                        onSelect={() => handleSelect(() => router.push("/docs/security"))}
                    >
                        <Settings className="mr-2 h-4 w-4 text-emerald-500" />
                        <span>Docs: Security, Compliance & Governance</span>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                {/* Format Presets */}
                <CommandGroup heading="New Analysis by Standard">
                    <CommandItem
                        value="format-ieee830"
                        onSelect={() => handleSelect(() => router.push("/analysis/new?format=ieee830"))}
                    >
                        <BookOpen className="mr-2 h-4 w-4 text-blue-500" />
                        <span>IEEE 830-1998 Specification</span>
                    </CommandItem>
                    <CommandItem
                        value="format-iso29148"
                        onSelect={() => handleSelect(() => router.push("/analysis/new?format=iso29148"))}
                    >
                        <BookOpen className="mr-2 h-4 w-4 text-purple-500" />
                        <span>ISO/IEC/IEEE 29148:2018 Standard</span>
                    </CommandItem>
                    <CommandItem
                        value="format-volere"
                        onSelect={() => handleSelect(() => router.push("/analysis/new?format=volere"))}
                    >
                        <BookOpen className="mr-2 h-4 w-4 text-orange-500" />
                        <span>Volere Requirements Specification</span>
                    </CommandItem>
                    <CommandItem
                        value="format-agileprd"
                        onSelect={() => handleSelect(() => router.push("/analysis/new?format=agileprd"))}
                    >
                        <Sparkles className="mr-2 h-4 w-4 text-pink-500" />
                        <span>Agile PRD & User Stories</span>
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    )
}
