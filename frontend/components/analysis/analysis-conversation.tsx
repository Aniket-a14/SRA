"use client"

import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Bot, User, Loader2, Sparkles, FileText, Send, Square, PanelRight } from "lucide-react"
import { cn, cleanInputText } from "@/lib/utils"
import { toast } from "sonner"
import { readSSEStream } from "@/lib/sse"
import { MarkdownDisplay } from "@/components/markdown-display"
import type { Analysis } from "@/types/analysis"

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

/**
 * clientMessageId is generated once per send and passed through to the backend, which
 * upserts on it (see chatService.js) — so a retried/duplicated request (double-click,
 * replayed fetch, browser back/forward) can't create a duplicate turn. Streams the
 * reply token-by-token from POST /:id/chat/stream instead of waiting for the full JSON.
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

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
    const { user } = useAuth()

    return (
        <div className={cn("flex gap-3 text-sm", role === "user" ? "flex-row-reverse" : "flex-row")}>
            <Avatar className="h-8 w-8 shrink-0 rounded-full">
                {role === "assistant" ? (
                    <div className="bg-foreground w-full h-full flex items-center justify-center rounded-full">
                        <Bot className="h-4 w-4 text-background" />
                    </div>
                ) : (
                    <>
                        <AvatarFallback className="rounded-full"><User className="h-4 w-4" /></AvatarFallback>
                        <AvatarImage src={user?.image} />
                    </>
                )}
            </Avatar>

            <div className={cn(
                "px-4 py-2.5 max-w-[75%] leading-relaxed",
                role === "user"
                    ? "bg-foreground text-background rounded-2xl rounded-tr-sm"
                    : "bg-transparent"
            )}>
                {children}
            </div>
        </div>
    )
}

interface AnalysisConversationProps {
    analysis: Analysis
    analysisId: string
    onAnalysisUpdate?: (newAnalysisId: string) => void
    hidden?: boolean
    isFinalized?: boolean
    onOpenCanvas?: () => void
    isCanvasOpen?: boolean
}

export function AnalysisConversation({ analysis, analysisId, onAnalysisUpdate, hidden, isFinalized, onOpenCanvas, isCanvasOpen }: AnalysisConversationProps) {
    const session = useChatSession(analysisId, onAnalysisUpdate)
    const { messages, input, setInput, isLoading, streamingId, onSendSubmit, handleStop } = session
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    const originalPrompt = cleanInputText(analysis.inputText || "") || analysis.title || "Untitled request"
    const sectionCount = analysis.systemFeatures?.length ?? 0

    if (hidden) return null

    return (
        <div className="flex flex-col h-full min-w-0">
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
                    {/* Synthetic opening exchange — frames the generated document as the
                        first turn of the conversation, ChatGPT/Gemini-style, instead of
                        presenting the document as a bare page with chat bolted on. */}
                    <Bubble role="user">{originalPrompt}</Bubble>

                    <Bubble role="assistant">
                        <div className="space-y-3">
                            <p>
                                I&apos;ve drafted your IEEE-830 SRS
                                {analysis.metadata?.optimized ? " using recycled requirements from your knowledge base" : ""}.
                            </p>
                            <button
                                type="button"
                                onClick={onOpenCanvas}
                                className="w-full text-left border border-foreground/10 hover:border-foreground/30 hover:bg-foreground/[0.02] transition-all px-4 py-3 flex items-center gap-3 rounded-lg"
                            >
                                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium truncate">{analysis.projectTitle || analysis.title || "SRS Document"}</p>
                                    <p className="text-xs text-muted-foreground font-mono">
                                        {sectionCount} feature{sectionCount === 1 ? "" : "s"} · v{analysis.version}
                                    </p>
                                </div>
                                <PanelRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                            </button>
                        </div>
                    </Bubble>

                    {messages.length === 0 && (
                        <p className="text-sm text-muted-foreground/70 text-center py-4">
                            Ask me to refine requirements, rewrite user stories, or update diagrams.
                        </p>
                    )}

                    {messages.map((msg) => (
                        <Bubble key={msg.id} role={msg.role}>
                            {msg.role === "assistant" ? (
                                msg.content
                                    ? <MarkdownDisplay content={msg.content} />
                                    : (msg.id === streamingId && <Loader2 className="h-4 w-4 animate-spin" />)
                            ) : msg.content}
                        </Bubble>
                    ))}
                    <div ref={scrollRef} />
                </div>
            </div>

            <div className="border-t border-foreground/10 shrink-0">
                <form onSubmit={onSendSubmit} className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-end gap-2">
                    <Textarea
                        placeholder={isFinalized ? "Analysis finalized — chat disabled" : "Refine a requirement, ask for a rewrite, or request a new diagram..."}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={isLoading || isFinalized}
                        rows={1}
                        className="min-h-[44px] max-h-40 resize-none rounded-2xl"
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault()
                                onSendSubmit()
                            }
                        }}
                    />
                    {isLoading ? (
                        <Button type="button" size="icon" variant="destructive" className="rounded-full shrink-0" onClick={handleStop}>
                            <Square className="h-4 w-4" />
                        </Button>
                    ) : (
                        <Button type="submit" size="icon" className="rounded-full shrink-0 bg-foreground text-background hover:bg-foreground/90" disabled={!input.trim() || isFinalized}>
                            <Send className="h-4 w-4" />
                        </Button>
                    )}
                </form>
            </div>

            {!isCanvasOpen && (
                <button
                    type="button"
                    onClick={onOpenCanvas}
                    className="md:hidden fixed bottom-24 right-4 h-12 w-12 rounded-full bg-foreground text-background shadow-lg flex items-center justify-center z-40"
                    aria-label="Open document"
                >
                    <Sparkles className="h-5 w-5" />
                </button>
            )}
        </div>
    )
}
