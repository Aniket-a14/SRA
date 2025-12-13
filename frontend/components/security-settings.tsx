"use client"
import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
        if (!ua) return "Unknown Device";
        const parser = new UAParser(ua);
        const browser = parser.getBrowser();
        const os = parser.getOS();
        const device = parser.getDevice(); // type, vendor, model

        const browserName = browser.name || "Unknown Browser";
        const osName = os.name || "Unknown OS";

        let deviceName = `${browserName} on ${osName}`;
        if (device.vendor && device.model) {
            deviceName = `${device.vendor} ${device.model} - ${deviceName}`;
        }
        return deviceName;
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
                                        <span className="text-muted-foreground">•</span>
                                        <span className="text-muted-foreground">{session.location || "Unknown Location"}</span>
                                        {session.isCurrent && (
                                            <span className="bg-green-500/10 text-green-600 text-[10px] px-2 py-0.5 rounded-full border border-green-500/20 font-medium">
                                                Active Now
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {session.isCurrent ? (
                                            <span className="text-green-600 font-medium">Active Now</span>
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
