"use client"

import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/lib/auth-context"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Bot, User, Loader2, Sparkles, MessageSquare, Send, Square } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { readSSEStream } from "@/lib/sse"
import { MarkdownDisplay } from "@/components/markdown-display"

interface ChatStreamEvent {
    type: "chunk" | "done" | "error"
    text?: string
    newAnalysisId?: string | null
    message?: string
}

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

/**
 * All chat state/streaming logic lives here, called exactly once per <ProjectChatPanel>
 * instance and shared by both the mobile overlay chrome and the desktop inline chrome
 * below — otherwise each variant would run its own independent chat session (duplicate
 * history fetch, duplicate stream on send) since both trees are always mounted
 * simultaneously (CSS, not JS, decides which one is visible at a given breakpoint).
 */
function useChatSession(analysisId: string, onAnalysisUpdate?: (newAnalysisId: string) => void) {
    const { token } = useAuth()
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [streamingId, setStreamingId] = useState<string | null>(null)
    const abortControllerRef = useRef<AbortController | null>(null)

    useEffect(() => {
        if (!token || !analysisId) return
        let cancelled = false

        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${analysisId}/chat`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.ok ? res.json() : null)
            .then(json => {
                if (cancelled || !json) return
                setMessages(json.data || json)
            })
            .catch(e => {
                console.error("Failed to load chat history", e)
                toast.error("Couldn't load chat history for this analysis.")
            })

        return () => { cancelled = true }
    }, [token, analysisId])

    // clientMessageId is generated once per send and passed through to the backend,
    // which upserts on it (see chatService.js) — so a retried/duplicated request
    // (double-click, replayed fetch, browser back/forward) can't create a duplicate
    // turn. Streams the reply token-by-token from POST /:id/chat/stream instead of
    // waiting for the full JSON response.
    const handleSend = async (userMsg: string, tempId: string) => {
        if (!userMsg.trim() || isLoading) return
        setIsLoading(true)

        const assistantId = `${tempId}_ai`
        setMessages(prev => [
            ...prev,
            { id: tempId, role: "user", content: userMsg },
            { id: assistantId, role: "assistant", content: "" }
        ])
        setStreamingId(assistantId)

        const controller = new AbortController()
        abortControllerRef.current = controller

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${analysisId}/chat/stream`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ message: userMsg, clientMessageId: tempId }),
                signal: controller.signal
            })

            if (!res.ok) {
                const json = await res.json().catch(() => ({}))
                throw new Error(json.error || "Failed to send message")
            }

            let newAnalysisId: string | null = null

            await readSSEStream(res, (data) => {
                const event = data as ChatStreamEvent
                if (event.type === "chunk" && event.text) {
                    setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: m.content + event.text } : m))
                } else if (event.type === "done") {
                    newAnalysisId = event.newAnalysisId || null
                } else if (event.type === "error") {
                    throw new Error(event.message || "Streaming failed");
                }
            }, controller.signal)

            if (newAnalysisId) {
                toast.success("Analysis updated! Redirecting to new version...")
                if (onAnalysisUpdate) onAnalysisUpdate(newAnalysisId)
            }

        } catch (e) {
            if ((e as Error).name === "AbortError") {
                // User clicked Stop — keep whatever streamed so far, no error toast.
            } else {
                console.error(e)
                toast.error("Failed to send message")
                setMessages(prev => prev.filter(m => m.id !== tempId && m.id !== assistantId)) // Rollback
            }
        } finally {
            setIsLoading(false)
            setStreamingId(null)
            abortControllerRef.current = null
        }
    }

    const onSendSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!input.trim() || isLoading) return;
        const currentInput = input;
        const tempId = crypto.randomUUID();
        setInput("");
        handleSend(currentInput, tempId);
    };

    const handleStop = () => {
        abortControllerRef.current?.abort()
    }

    return { messages, input, setInput, isLoading, streamingId, onSendSubmit, handleStop }
}

type ChatSession = ReturnType<typeof useChatSession>

function ChatMessageList({ messages, streamingId, className }: { messages: ChatMessage[]; streamingId: string | null; className?: string }) {
    const { user } = useAuth()
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    return (
        <div className={cn("flex-1 overflow-y-auto p-6", className)}>
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
                            {msg.role === "assistant" ? (
                                msg.content
                                    ? <MarkdownDisplay content={msg.content} />
                                    : (msg.id === streamingId && <Loader2 className="h-4 w-4 animate-spin" />)
                            ) : msg.content}
                        </div>
                    </div>
                ))}
                <div ref={scrollRef} />
            </div>
        </div>
    )
}

function ChatComposer({ session, isFinalized }: { session: ChatSession; isFinalized?: boolean }) {
    const { input, setInput, isLoading, onSendSubmit, handleStop } = session

    return (
        <div className="p-4 border-t mt-auto">
            <form onSubmit={onSendSubmit} className="flex gap-2">
                <Input
                    placeholder={isFinalized ? "Analysis finalized - Chat disabled" : "Type a message..."}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isLoading || isFinalized}
                />
                {isLoading ? (
                    <Button type="button" size="icon" variant="destructive" onClick={handleStop}>
                        <Square className="h-4 w-4" />
                    </Button>
                ) : (
                    <Button type="submit" size="icon" disabled={!input.trim() || isFinalized}>
                        <Send className="h-4 w-4" />
                    </Button>
                )}
            </form>
        </div>
    )
}

/**
 * Renders BOTH chromes at all times and lets CSS breakpoints decide which one is
 * visible — the same pattern AppSidebar already uses (`hidden md:flex`) — rather than
 * a JS media-query hook, so there's no client/server hydration mismatch and no
 * remount/lost-state on a resize across the breakpoint.
 */
export function ProjectChatPanel({ analysisId, onAnalysisUpdate, hidden, isFinalized }: ProjectChatPanelProps) {
    const session = useChatSession(analysisId, onAnalysisUpdate)
    const [isOpen, setIsOpen] = useState(false)

    if (!analysisId) return null

    return (
        <>
            {/* Mobile: floating button + slide-in Sheet */}
            <div className={cn("md:hidden", hidden && "hidden")}>
                <Sheet open={isOpen} onOpenChange={setIsOpen}>
                    <SheetTrigger asChild>
                        <Button
                            variant="default"
                            size="icon"
                            className={cn(
                                "fixed bottom-8 right-8 h-14 w-14 rounded-full shadow-xl bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transition-all z-[100]",
                                isOpen && "opacity-0 translate-x-10 pointer-events-none"
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
                        <ChatMessageList messages={session.messages} streamingId={session.streamingId} />
                        <ChatComposer session={session} isFinalized={isFinalized} />
                    </SheetContent>
                </Sheet>
            </div>

            {/* Desktop: persistent inline panel, a flex sibling of <main> in the analysis
                page's layout — not an overlay, so it's always visible alongside the
                results view rather than needing to be toggled open. A `display:none`
                flex item reserves no space, so this needs no JS media-query gymnastics
                to avoid an empty gap on mobile — plain CSS is enough. */}
            <div className={cn(
                "hidden md:flex md:flex-col md:w-[380px] md:shrink-0 md:h-full md:border-l bg-background",
                hidden && "md:hidden"
            )}>
                <div className="p-4 border-b flex items-center gap-2 shrink-0">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <span className="font-semibold">AI Analysis Assistant</span>
                </div>
                <ChatMessageList messages={session.messages} streamingId={session.streamingId} />
                <ChatComposer session={session} isFinalized={isFinalized} />
            </div>
        </>
    )
}
