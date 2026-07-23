"use client"
import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Laptop, Smartphone, Globe, Clock, ShieldAlert } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import { UAParser } from "ua-parser-js"

interface Session {
    id: string
    userAgent: string | null
    ipAddress: string | null
    location: string | null
    isCurrent?: boolean
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
        let isMounted = true;
        if (token && isMounted) {
            Promise.resolve().then(() => {
                if (isMounted) fetchSessions();
            });
        }
        return () => { isMounted = false; };
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
        } catch {
            toast.error("Error revoking session")
        }
    }

    const getIcon = (ua: string | null) => {
        if (!ua) return <Globe className="h-5 w-5" />
        const parser = new UAParser(ua)
        const device = parser.getDevice()
        if (device.type === "mobile" || device.type === "tablet") return <Smartphone className="h-5 w-5" />
        return <Laptop className="h-5 w-5" />
    }

    const getDeviceName = (ua: string | null) => {
        if (!ua) return "Unknown device";
        const parser = new UAParser(ua);
        const browser = parser.getBrowser();
        const os = parser.getOS();
        const device = parser.getDevice();

        const browserName = browser.name || "Unknown browser";
        const osName = os.name || "Unknown OS";

        let deviceName = `${browserName} on ${osName}`;
        if (device.vendor && device.model) {
            deviceName = `${device.vendor} ${device.model} - ${deviceName}`;
        }
        return deviceName;
    }

    if (isLoading) return <div className="text-sm text-muted-foreground">Loading security settings...</div>

    return (
        <div className="border border-foreground/10 p-6">
            <h3 className="flex items-center gap-2 font-medium mb-1">
                <ShieldAlert className="h-4 w-4" />
                Active sessions
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
                Manage devices and browsers currently signed in to your account.
            </p>

            <div className="space-y-3">
                {sessions.length === 0 && (
                    <div className="text-muted-foreground text-sm">No active sessions found.</div>
                )}
                {sessions.map((session) => (
                    <div key={session.id} className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between p-4 border border-foreground/10">
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                            <div className="p-2 border border-foreground/10 shrink-0">
                                {getIcon(session.userAgent)}
                            </div>
                            <div className="space-y-1 min-w-0">
                                <div className="font-medium text-sm flex flex-wrap items-center gap-2">
                                    {session.ipAddress || "Unknown IP"}
                                    <span className="text-muted-foreground hidden sm:inline">•</span>
                                    <span className="text-muted-foreground">{session.location || "Unknown location"}</span>
                                    {session.isCurrent && (
                                        <span className="bg-green-500/10 text-green-600 text-[10px] px-2 py-0.5 rounded-full border border-green-500/20 font-medium shrink-0">
                                            Active now
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {session.isCurrent ? (
                                        <span className="text-green-600 font-medium">Active now</span>
                                    ) : (
                                        <span>Last active {formatDistanceToNow(new Date(session.lastUsedAt))} ago</span>
                                    )}
                                </div>
                                <div className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-[300px]">
                                    {getDeviceName(session.userAgent)}
                                </div>
                            </div>
                        </div>
                        <Button
                            variant="destructive"
                            size="sm"
                            className="w-full sm:w-auto rounded-full"
                            onClick={() => revokeSession(session.id)}
                        >
                            Revoke
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    )
}
