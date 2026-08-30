"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import useSWR from "swr"
import { createAuthFetcher, swrOptions } from "@/lib/swr-utils"
import { useAuthFetch } from "@/lib/hooks"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { resumeAnalysis } from "@/lib/analysis-api"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import {
    Activity,
    Clock,
    AlertCircle,
    CheckCircle2,
    RotateCcw,
    ArrowRight,
    Loader2,
    RefreshCw
} from "lucide-react"
import { formatRelative } from "@/lib/format-date"
import { cleanInputText } from "@/lib/utils"
import { toast } from "sonner"
import { ResumeWithModel } from "@/components/analysis/resume-with-model"

export interface ActivityTaskItem {
    id: string
    createdAt: string
    inputText: string
    inputPreview: string
    version?: number
    title?: string
    status?: string
    resultQuality?: string
    projectId?: string | null
    rootId?: string
    parentId?: string | null
    resumable?: boolean
    failureReason?: string
    metadata?: Record<string, unknown>
}

interface ActivityCenterProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ActivityCenter({ open, onOpenChange }: ActivityCenterProps) {
    const router = useRouter()
    const { token } = useAuth()
    const authFetch = useAuthFetch()
    const swrFetcher = React.useMemo(() => createAuthFetcher(authFetch), [authFetch])

    const swrKey = React.useMemo(() => {
        if (!token) return null
        return [`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze`, token] as const
    }, [token])

    const { data: historyData, mutate, isValidating } = useSWR<ActivityTaskItem[]>(
        swrKey,
        swrFetcher,
        {
            ...swrOptions,
            refreshInterval: 5000 // Poll every 5s when activity center is active
        }
    )

    const tasks = React.useMemo(() => (Array.isArray(historyData) ? historyData : []), [historyData])

    const runningTasks = React.useMemo(() => {
        return tasks.filter(t => {
            const s = (t.status || "").toUpperCase()
            return s === "PENDING" || s === "IN_PROGRESS" || s === "QUEUED"
        })
    }, [tasks])

    const completedTasks = React.useMemo(() => {
        return tasks.filter(t => {
            const s = (t.status || "").toUpperCase()
            return s === "COMPLETED"
        })
    }, [tasks])

    const failedTasks = React.useMemo(() => {
        return tasks.filter(t => {
            const s = (t.status || "").toUpperCase()
            return s === "FAILED"
        })
    }, [tasks])

    const [activeTab, setActiveTab] = React.useState<string>("all")
    const [resumeTargetId, setResumeTargetId] = React.useState<string | null>(null)

    const handleNavigate = (taskId: string) => {
        onOpenChange(false)
        router.push(`/analysis/${taskId}`)
    }

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col h-full">
                    <SheetHeader className="px-6 py-4 border-b border-foreground/10 shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-lg bg-foreground/5 text-foreground">
                                    <Activity className="h-5 w-5" />
                                </div>
                                <div>
                                    <SheetTitle className="text-xl font-display">Activity & Tasks</SheetTitle>
                                    <SheetDescription className="text-xs">
                                        Monitor async AI pipelines, executions, and recovery
                                    </SheetDescription>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => mutate()}
                                disabled={isValidating}
                                title="Refresh activities"
                            >
                                <RefreshCw className={`h-4 w-4 ${isValidating ? "animate-spin" : ""}`} />
                            </Button>
                        </div>
                    </SheetHeader>

                    {/* Tabs Bar */}
                    <div className="px-6 pt-4 pb-2 border-b border-foreground/5 shrink-0">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid grid-cols-4 w-full h-9">
                                <TabsTrigger value="all" className="text-xs">
                                    All ({tasks.length})
                                </TabsTrigger>
                                <TabsTrigger value="running" className="text-xs flex items-center gap-1">
                                    {runningTasks.length > 0 && (
                                        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                                    )}
                                    Running ({runningTasks.length})
                                </TabsTrigger>
                                <TabsTrigger value="completed" className="text-xs">
                                    Done ({completedTasks.length})
                                </TabsTrigger>
                                <TabsTrigger value="failed" className="text-xs">
                                    Failed ({failedTasks.length})
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>

                    {/* Task List Content */}
                    <ScrollArea className="flex-1 px-6 py-4">
                        {activeTab === "all" && (
                            <TaskList
                                tasks={tasks}
                                onNavigate={handleNavigate}
                                onResume={(id) => setResumeTargetId(id)}
                            />
                        )}
                        {activeTab === "running" && (
                            <TaskList
                                tasks={runningTasks}
                                onNavigate={handleNavigate}
                                onResume={(id) => setResumeTargetId(id)}
                                emptyText="No active AI tasks running right now."
                            />
                        )}
                        {activeTab === "completed" && (
                            <TaskList
                                tasks={completedTasks}
                                onNavigate={handleNavigate}
                                onResume={(id) => setResumeTargetId(id)}
                                emptyText="No completed specifications yet."
                            />
                        )}
                        {activeTab === "failed" && (
                            <TaskList
                                tasks={failedTasks}
                                onNavigate={handleNavigate}
                                onResume={(id) => setResumeTargetId(id)}
                                emptyText="No failed analyses."
                            />
                        )}
                    </ScrollArea>

                    {/* Quick Footer */}
                    <div className="border-t border-foreground/10 px-6 py-3 bg-muted/20 flex items-center justify-between shrink-0">
                        <span className="text-xs text-muted-foreground">
                            {runningTasks.length} background job{runningTasks.length === 1 ? "" : "s"} in flight
                        </span>
                        <Button
                            variant="default"
                            size="sm"
                            className="text-xs h-8"
                            onClick={() => {
                                onOpenChange(false)
                                router.push("/analysis/new")
                            }}
                        >
                            New Analysis
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>

            {/* Resume with Model Dialog */}
            {resumeTargetId && (
                <Dialog open={Boolean(resumeTargetId)} onOpenChange={(open) => !open && setResumeTargetId(null)}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Resume Analysis</DialogTitle>
                            <DialogDescription className="text-xs">
                                Pick an alternate provider or model if quota was exhausted. Existing stage checkpoints will be preserved.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-2">
                            <ResumeWithModel
                                onResume={async (model) => {
                                    try {
                                        if (!token) return
                                        toast.loading("Resuming analysis...", { id: "resume-task" })
                                        await resumeAnalysis(resumeTargetId, token, model, authFetch)
                                        toast.success("Analysis resumed successfully!", { id: "resume-task" })
                                        setResumeTargetId(null)
                                        mutate()
                                    } catch (err: unknown) {
                                        const msg = err instanceof Error ? err.message : "Failed to resume analysis"
                                        toast.error(msg, { id: "resume-task" })
                                    }
                                }}
                            />
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </>
    )
}

function TaskList({
    tasks,
    onNavigate,
    onResume,
    emptyText = "No tasks found."
}: {
    tasks: ActivityTaskItem[]
    onNavigate: (id: string) => void
    onResume: (id: string) => void
    emptyText?: string
}) {
    if (tasks.length === 0) {
        return (
            <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                <Clock className="h-8 w-8 opacity-30" />
                <p className="text-sm">{emptyText}</p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {tasks.map((task) => (
                <TaskCard
                    key={task.id}
                    task={task}
                    onNavigate={() => onNavigate(task.id)}
                    onResume={() => onResume(task.id)}
                />
            ))}
        </div>
    )
}

function TaskCard({
    task,
    onNavigate,
    onResume
}: {
    task: ActivityTaskItem
    onNavigate: () => void
    onResume: () => void
}) {
    const status = (task.status || "").toUpperCase()
    const isRunning = status === "PENDING" || status === "IN_PROGRESS" || status === "QUEUED"
    const isFailed = status === "FAILED"
    const isCompleted = status === "COMPLETED"

    return (
        <div className="rounded-lg border border-foreground/10 bg-card p-4 hover:border-foreground/25 transition-all space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">
                            {task.title || "Requirements Analysis"}
                        </span>
                        <Badge variant="outline" className="h-4 px-1 text-[10px] font-mono border-foreground/10">
                            v{task.version || 1}
                        </Badge>
                        {isRunning && (
                            <Badge className="h-5 px-1.5 text-[10px] font-mono bg-amber-500/10 text-amber-600 border-transparent flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {status === "PENDING" ? "Queued" : "Processing"}
                            </Badge>
                        )}
                        {isCompleted && (
                            <Badge className="h-5 px-1.5 text-[10px] font-mono bg-emerald-500/10 text-emerald-600 border-transparent flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Completed
                            </Badge>
                        )}
                        {isFailed && (
                            <Badge className="h-5 px-1.5 text-[10px] font-mono bg-destructive/10 text-destructive border-transparent flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Failed
                            </Badge>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {cleanInputText(task.inputPreview || task.inputText || "")}
                    </p>
                </div>
            </div>

            {/* If running, show an active indeterminate progress indicator */}
            {isRunning && (
                <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                        <span>5-Layer Multi-Agent Pipeline</span>
                        <span className="animate-pulse">Active</span>
                    </div>
                    <Progress value={60} className="h-1.5" />
                </div>
            )}

            {/* If failed, show failure reason */}
            {isFailed && task.failureReason && (
                <div className="rounded bg-destructive/5 border border-destructive/10 p-2 text-xs text-destructive/90">
                    <p className="line-clamp-2">{task.failureReason}</p>
                </div>
            )}

            {/* Bottom metadata & action bar */}
            <div className="flex items-center justify-between pt-1 border-t border-foreground/5 text-xs">
                <span className="text-muted-foreground flex items-center gap-1 font-mono text-[11px]">
                    <Clock className="h-3 w-3" />
                    {formatRelative(task.createdAt)}
                </span>

                <div className="flex items-center gap-2">
                    {isFailed ? (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 border-destructive/30 hover:bg-destructive/10 text-destructive"
                            onClick={(e) => {
                                e.stopPropagation()
                                onResume()
                            }}
                        >
                            <RotateCcw className="h-3 w-3" />
                            Resume
                        </Button>
                    ) : null}

                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1 text-foreground hover:bg-foreground/5"
                        onClick={onNavigate}
                    >
                        <span>{isRunning ? "View Stream" : "Open"}</span>
                        <ArrowRight className="h-3 w-3" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
