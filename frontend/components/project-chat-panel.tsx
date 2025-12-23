"use client"

import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/lib/auth-context"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MessageSquare, Send, Bot, User, Loader2, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface ChatMessage {
    id: string
    role: "user" | "assistant"
    content: string
}

interface ProjectChatPanelProps {
    analysisId: string
    onAnalysisUpdate?: (newAnalysisId: string) => void
    hidden?: boolean
    isFinalized?: boolean
}

export function ProjectChatPanel({ analysisId, onAnalysisUpdate, hidden, isFinalized }: ProjectChatPanelProps) {
    const { token, user } = useAuth()

    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    // Moved fetchHistory definition to be accessible and memoized or used inside effect

    useEffect(() => {
        const fetchHistory = async () => {
            if (!token || !analysisId) return;
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${analysisId}/chat`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                if (res.ok) {
                    const data = await res.json()
                    setMessages(data)
                }
            } catch (e) {
                console.error("Failed to load chat history", e)
            }
        }

        if (isOpen && token && analysisId) {
            fetchHistory()
        }
    }, [isOpen, token, analysisId])

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" })
        }
    }, [messages])


    // Safety check: Don't render if critical data is missing
    if (!analysisId) return null;

    const handleSend = async () => {
        if (!input.trim() || isLoading) return

        const userMsg = input
        setInput("")
        setIsLoading(true)

        // Optimistic UI
        const tempId = Date.now().toString()
        setMessages(prev => [...prev, { id: tempId, role: "user", content: userMsg }])

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${analysisId}/chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ message: userMsg })
            })

            const data = await res.json()

            if (!res.ok) throw new Error(data.error || "Failed to send message")

            // Add AI response
            setMessages(prev => [
                ...prev,
                { id: Date.now().toString() + "_ai", role: "assistant", content: data.reply }
            ])

            if (data.newAnalysisId) {
                toast.success("Analysis updated! Redirecting to new version...")
                if (onAnalysisUpdate) onAnalysisUpdate(data.newAnalysisId)
            }

        } catch (e) {
            console.error(e)
            toast.error("Failed to send message")
            setMessages(prev => prev.filter(m => m.id !== tempId)) // Rollback
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <Button
                    variant="default"
                    size="icon"
                    className={cn(
                        "fixed bottom-8 right-8 h-14 w-14 rounded-full shadow-xl bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transition-all z-[100]",
                        (isOpen || hidden) && "opacity-0 translate-x-10 pointer-events-none"
                    )}
                >
                    <MessageSquare className="h-6 w-6" />
                </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px] flex flex-col p-0">
                <SheetHeader className="p-6 border-b">
                    <SheetTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        AI Analysis Assistant
                    </SheetTitle>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto p-6">
                    <div className="flex flex-col gap-4">
                        {messages.length === 0 && (
                            <div className="text-center text-muted-foreground py-8">
                                <p>Ask me to refine requirements, rewrite user stories, or update diagrams.</p>
                            </div>
                        )}

                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={cn(
                                    "flex gap-3 text-sm",
                                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                                )}
                            >
                                <Avatar className="h-8 w-8 shrink-0">
                                    {msg.role === "assistant" ? (
                                        <div className="bg-primary/10 w-full h-full flex items-center justify-center">
                                            <Bot className="h-4 w-4 text-primary" />
                                        </div>
                                    ) : (
                                        <>
                                            <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                                            <AvatarImage src={user?.image} />
                                        </>
                                    )}
                                </Avatar>

                                <div className={cn(
                                    "rounded-lg px-4 py-2 max-w-[80%]",
                                    msg.role === "user"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted"
                                )}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex gap-3 text-sm">
                                <Avatar className="h-8 w-8 shrink-0">
                                    <div className="bg-primary/10 w-full h-full flex items-center justify-center">
                                        <Bot className="h-4 w-4 text-primary" />
                                    </div>
                                </Avatar>
                                <div className="bg-muted rounded-lg px-4 py-2 flex items-center">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                </div>
                            </div>
                        )}
                        <div ref={scrollRef} />
                    </div>
                </div>

                <div className="p-4 border-t mt-auto">
                    <form
                        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                        className="flex gap-2"
                    >
                        <Input
                            placeholder={isFinalized ? "Analysis finalized - Chat disabled" : "Type a message..."}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={isLoading || isFinalized}
                        />
                        <Button type="submit" size="icon" disabled={isLoading || !input.trim() || isFinalized}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                </div>
            </SheetContent>
        </Sheet>
    )
}
