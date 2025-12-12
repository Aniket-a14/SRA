"use client"
import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Laptop, Smartphone, Globe, Clock, ShieldAlert } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"

interface Session {
    id: string
    userAgent: string | null
    ipAddress: string | null
    lastUsedAt: string
    createdAt: string
    expiresAt: string
}

export function SecuritySettings() {
    const { token } = useAuth()
    const [sessions, setSessions] = useState<Session[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const fetchSessions = useCallback(async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/sessions`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (res.ok) {
                const data = await res.json()
                setSessions(data)
            }
        } catch (error) {
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }, [token])

    useEffect(() => {
        if (token) fetchSessions()
    }, [token, fetchSessions])

    const revokeSession = async (sessionId: string) => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/sessions/${sessionId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            })
            if (res.ok) {
                toast.success("Session revoked")
                setSessions(prev => prev.filter(s => s.id !== sessionId))
            } else {
                toast.error("Failed to revoke session")
            }
        } catch (_error) {
            toast.error("Error revoking session")
        }
    }

    const getIcon = (ua: string | null) => {
        if (!ua) return <Globe className="h-5 w-5" />
        if (ua.toLowerCase().includes("mobile")) return <Smartphone className="h-5 w-5" />
        return <Laptop className="h-5 w-5" />
    }

    if (isLoading) return <div>Loading security settings...</div>

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-primary" />
                    Active Sessions
                </CardTitle>
                <CardDescription>
                    Manage devices and browsers that are currently logged in to your account.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {sessions.length === 0 && (
                        <div className="text-muted-foreground text-sm">No active sessions found.</div>
                    )}
                    {sessions.map((session) => (
                        <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-background rounded-full border">
                                    {getIcon(session.userAgent)}
                                </div>
                                <div className="space-y-1">
                                    <div className="font-medium text-sm flex items-center gap-2">
                                        {session.ipAddress || "Unknown IP"}
                                        {/* Identify current session if possible? Requires tracking current session ID in context or matching refresh token. Omitted for simplicity now. */}
                                    </div>
                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        Last active {formatDistanceToNow(new Date(session.lastUsedAt))} ago
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-[300px]">
                                        {session.userAgent || "Unknown Device"}
                                    </div>
                                </div>
                            </div>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => revokeSession(session.id)}
                            >
                                Revoke
                            </Button>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
