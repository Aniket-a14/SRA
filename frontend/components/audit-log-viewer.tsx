"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/lib/auth-context"
import { useAuthFetch } from "@/lib/hooks"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Shield,
    Download,
    RefreshCw,
    Key,
    FolderKanban,
    FileText,
    LogIn,
    LogOut,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Eye,
    ChevronLeft,
    ChevronRight,
    Activity
} from "lucide-react"
import { formatRelative } from "@/lib/format-date"
import { toast } from "sonner"

interface AuditLogEntry {
    id: string
    action: string
    resource: string | null
    resourceId: string | null
    ipAddress: string | null
    userAgent: string | null
    status: string
    metadata: Record<string, unknown> | null
    createdAt: string
}

interface PaginationMeta {
    page: number
    limit: number
    total: number
    totalPages: number
}

const ACTION_ICONS: Record<string, React.ElementType> = {
    LOGIN_SUCCESS: LogIn,
    LOGIN_FAILURE: LogIn,
    LOGOUT: LogOut,
    PASSWORD_CHANGE: Key,
    CREATE_PROJECT: FolderKanban,
    DELETE_PROJECT: FolderKanban,
    CREATE_ANALYSIS: FileText,
    DELETE_ANALYSIS: FileText,
    FINALIZE_ANALYSIS: FileText,
    EXPORT_DATA: Download,
    SUSPICIOUS_ACTIVITY: AlertTriangle,
}

export function AuditLogViewer() {
    const { token } = useAuth()
    const authFetch = useAuthFetch()
    const [logs, setLogs] = useState<AuditLogEntry[]>([])
    const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: 10, total: 0, totalPages: 1 })
    const [isLoading, setIsLoading] = useState(true)
    const [selectedAction, setSelectedAction] = useState<string>("ALL")
    const [inspectEntry, setInspectEntry] = useState<AuditLogEntry | null>(null)

    const fetchLogs = useCallback(async (page = 1, actionFilter = selectedAction) => {
        setIsLoading(true)
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: "10",
            })
            if (actionFilter && actionFilter !== "ALL") {
                params.append("action", actionFilter)
            }

            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || ""
            const res = await authFetch(`${backendUrl}/auth/me/audit-logs?${params.toString()}`)
            if (res.ok) {
                const responseData = await res.json()
                setLogs(responseData.data || [])
                if (responseData.pagination) {
                    setPagination(responseData.pagination)
                }
            } else {
                toast.error("Failed to load audit logs")
            }
        } catch (error) {
            console.error("Audit logs fetch error", error)
            toast.error("Network error while retrieving audit logs")
        } finally {
            setIsLoading(false)
        }
    }, [authFetch, selectedAction])

    useEffect(() => {
        let isMounted = true
        if (token && isMounted) {
            Promise.resolve().then(() => {
                if (isMounted) fetchLogs(1, selectedAction)
            })
        }
        return () => {
            isMounted = false
        }
    }, [token, selectedAction, fetchLogs])

    const handleExportCSV = () => {
        if (logs.length === 0) {
            toast.info("No audit logs to export.")
            return
        }

        const headers = ["Timestamp", "Action", "Status", "Resource", "Resource ID", "IP Address", "User Agent"]
        const rows = logs.map(l => [
            `"${new Date(l.createdAt).toISOString()}"`,
            `"${l.action}"`,
            `"${l.status}"`,
            `"${l.resource || ""}"`,
            `"${l.resourceId || ""}"`,
            `"${l.ipAddress || ""}"`,
            `"${(l.userAgent || "").replace(/"/g, '""')}"`
        ])

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n")
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", `sra-audit-log-${new Date().toISOString().slice(0, 10)}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        toast.success("Audit log CSV exported successfully")
    }

    const renderStatusBadge = (status: string) => {
        const s = status.toLowerCase()
        if (s === "success") {
            return (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-200 text-xs font-mono gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Success
                </Badge>
            )
        }
        if (s === "warning") {
            return (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-200 text-xs font-mono gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Warning
                </Badge>
            )
        }
        return (
            <Badge variant="outline" className="bg-rose-500/10 text-rose-700 border-rose-200 text-xs font-mono gap-1">
                <XCircle className="h-3 w-3" />
                Failure
            </Badge>
        )
    }

    return (
        <Card className="border-border">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
                <div className="space-y-1">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <Activity className="h-5 w-5 text-primary" />
                        Activity &amp; Audit Trail
                    </CardTitle>
                    <CardDescription>
                        A queryable security log of authentication events, project mutations, and data access on your account.
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchLogs(pagination.page, selectedAction)}
                        disabled={isLoading}
                        className="h-8 gap-1 text-xs"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportCSV}
                        disabled={logs.length === 0}
                        className="h-8 gap-1 text-xs"
                    >
                        <Download className="h-3.5 w-3.5" />
                        Export CSV
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Filters */}
                <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-muted-foreground uppercase">Filter:</span>
                    <Select
                        value={selectedAction}
                        onValueChange={(val) => {
                            setSelectedAction(val)
                            fetchLogs(1, val)
                        }}
                    >
                        <SelectTrigger className="w-[200px] h-8 text-xs">
                            <SelectValue placeholder="All Activities" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Activities</SelectItem>
                            <SelectItem value="LOGIN_SUCCESS">Login Success</SelectItem>
                            <SelectItem value="LOGIN_FAILURE">Login Failure</SelectItem>
                            <SelectItem value="LOGOUT">Logout</SelectItem>
                            <SelectItem value="CREATE_PROJECT">Create Project</SelectItem>
                            <SelectItem value="DELETE_PROJECT">Delete Project</SelectItem>
                            <SelectItem value="CREATE_ANALYSIS">Create Analysis</SelectItem>
                            <SelectItem value="DELETE_ANALYSIS">Delete Analysis</SelectItem>
                            <SelectItem value="FINALIZE_ANALYSIS">Finalize Analysis</SelectItem>
                            <SelectItem value="EXPORT_DATA">Export Data</SelectItem>
                            <SelectItem value="SUSPICIOUS_ACTIVITY">Security Alerts</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Table */}
                <div className="rounded-md border overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/30">
                                <TableHead className="w-[180px] text-xs font-mono">Event</TableHead>
                                <TableHead className="text-xs font-mono">Status</TableHead>
                                <TableHead className="text-xs font-mono">Resource</TableHead>
                                <TableHead className="text-xs font-mono">IP Address</TableHead>
                                <TableHead className="text-xs font-mono">Time</TableHead>
                                <TableHead className="w-[70px] text-right text-xs font-mono">Details</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                                        <div className="flex items-center justify-center gap-2">
                                            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                                            Loading audit records...
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                                        <div className="flex flex-col items-center justify-center gap-1">
                                            <Shield className="h-5 w-5 text-muted-foreground/50 mb-1" />
                                            <span>No audit events recorded yet for this filter.</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                logs.map((log) => {
                                    const Icon = ACTION_ICONS[log.action] || Activity
                                    return (
                                        <TableRow key={log.id} className="hover:bg-muted/40 transition-colors">
                                            <TableCell className="font-mono text-xs">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1 rounded bg-muted">
                                                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                                    </div>
                                                    <span className="font-medium text-foreground">{log.action}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>{renderStatusBadge(log.status)}</TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">
                                                {log.resource || "—"}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground">
                                                {log.ipAddress || "—"}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                <span title={new Date(log.createdAt).toLocaleString()}>
                                                    {formatRelative(log.createdAt)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => setInspectEntry(log)}
                                                    title="View Event Details"
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between pt-2">
                        <span className="text-xs text-muted-foreground font-mono">
                            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total events)
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fetchLogs(pagination.page - 1)}
                                disabled={pagination.page <= 1 || isLoading}
                                className="h-8 text-xs gap-1"
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fetchLogs(pagination.page + 1)}
                                disabled={pagination.page >= pagination.totalPages || isLoading}
                                className="h-8 text-xs gap-1"
                            >
                                Next
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>

            {/* Inspect Metadata Dialog */}
            <Dialog open={!!inspectEntry} onOpenChange={(open) => !open && setInspectEntry(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 font-mono text-base">
                            <Shield className="h-4 w-4 text-primary" />
                            Audit Event Inspector
                        </DialogTitle>
                        <DialogDescription className="font-mono text-xs">
                            Event ID: {inspectEntry?.id}
                        </DialogDescription>
                    </DialogHeader>

                    {inspectEntry && (
                        <div className="space-y-3 text-xs">
                            <div className="grid grid-cols-2 gap-2 p-3 bg-muted/30 rounded-md border font-mono">
                                <div>
                                    <span className="text-muted-foreground block">Action:</span>
                                    <span className="font-semibold">{inspectEntry.action}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Status:</span>
                                    <span>{inspectEntry.status}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Timestamp:</span>
                                    <span>{new Date(inspectEntry.createdAt).toISOString()}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">IP Address:</span>
                                    <span>{inspectEntry.ipAddress || "None"}</span>
                                </div>
                            </div>

                            {inspectEntry.userAgent && (
                                <div>
                                    <span className="font-mono text-muted-foreground block mb-1">User Agent:</span>
                                    <div className="p-2 bg-muted/20 border rounded font-mono text-[11px] break-all">
                                        {inspectEntry.userAgent}
                                    </div>
                                </div>
                            )}

                            <div>
                                <span className="font-mono text-muted-foreground block mb-1">Metadata:</span>
                                <pre className="p-3 bg-slate-900 text-slate-100 dark:bg-slate-950 rounded-md font-mono text-[11px] overflow-x-auto max-h-48">
                                    {JSON.stringify(inspectEntry.metadata || {}, null, 2)}
                                </pre>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </Card>
    )
}
