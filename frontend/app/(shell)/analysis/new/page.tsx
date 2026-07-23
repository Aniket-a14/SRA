"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { fetchProject } from "@/lib/projects-api"
import { PromptSettings } from "@/types/project"
import { toast } from "sonner"
import { Folder, Sparkles, SlidersHorizontal, Loader2, ArrowUp, KeyRound, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const DEFAULT_SETTINGS: PromptSettings = {
    profile: "default",
    depth: 3,
    strictness: 3,
    modelProvider: "google",
    modelName: "gemini-2.5-flash",
}

const PROFILES = [
    { value: "default", label: "General Software (Default)" },
    { value: "business_analyst", label: "Business Analyst (ROI Focused)" },
    { value: "system_architect", label: "System Architect (Tech Focused)" },
    { value: "security_analyst", label: "Security Analyst (Safety Focused)" },
]

const MODELS = [
    { provider: "google", value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", hint: "Fast" },
    { provider: "google", value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", hint: "Advanced" },
    { provider: "openai", value: "gpt-5.6", label: "GPT-5.6", hint: "Smartest" },
    { provider: "openai", value: "gpt-5.6-luna", label: "GPT-5.6 Luna", hint: "Fast" },
    { provider: "claude", value: "claude-opus-4-8", label: "Claude Opus 4.8", hint: "Smartest" },
    { provider: "claude", value: "claude-sonnet-5", label: "Claude Sonnet 5", hint: "Fast" },
    { provider: "grok", value: "grok-4.5", label: "Grok 4.5", hint: "" },
]

// Gemini runs on the platform's own key — every other provider requires the
// user to have added their own key in Settings (see providerKeyService.js).
const PROVIDER_TO_ENUM: Record<string, string> = {
    google: "GEMINI",
    openai: "OPENAI",
    claude: "CLAUDE",
    grok: "GROK",
}

const EXAMPLES = [
    "A subscription billing platform with tiered plans, dunning, and Stripe payouts.",
    "An IoT fleet dashboard that ingests sensor telemetry and raises threshold alerts.",
    "A patient intake portal with insurance verification and HIPAA-compliant records.",
    "A multi-vendor marketplace with escrow payments, reviews, and dispute resolution.",
]

function deriveName(text: string): string {
    const words = text.trim().replace(/\s+/g, " ").split(" ").slice(0, 6).join(" ")
    return words.length > 60 ? words.slice(0, 60) : words
}

function NewAnalysisContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { token, user } = useAuth()
    const projectId = searchParams.get("projectId")

    const [projectName, setProjectName] = useState("")
    const [description, setDescription] = useState("")
    const [settings, setSettings] = useState<PromptSettings>(DEFAULT_SETTINGS)
    const [configuredProviders, setConfiguredProviders] = useState<Set<string>>(new Set(["GEMINI"]))
    const [contextProjectName, setContextProjectName] = useState<string>("")
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        if (projectId && token) {
            fetchProject(token, projectId).then(p => {
                setContextProjectName(p.name)
                if (p.settings) setSettings(p.settings)
            }).catch(() => setContextProjectName("Unknown project"))
        }
    }, [projectId, token])

    useEffect(() => {
        if (!token) return
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/settings/provider-keys`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.ok ? res.json() : { data: [] })
            .then(json => {
                const keys = (json.data || json) as { provider: string; isActive: boolean }[]
                const active = keys.filter(k => k.isActive).map(k => k.provider)
                setConfiguredProviders(new Set(["GEMINI", ...active]))
            })
            .catch(() => { /* non-fatal — falls back to Gemini-only */ })
    }, [token])

    // Auto-grow the composer as the description grows, ChatGPT-style.
    useEffect(() => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = "auto"
        el.style.height = `${Math.min(el.scrollHeight, 320)}px`
    }, [description])

    const activeModel = MODELS.find(m => m.value === settings.modelName) || MODELS[0]
    const onlyGemini = configuredProviders.size === 1

    const handleAnalyze = async () => {
        if (!token) {
            toast.error("You must be logged in to start an analysis.")
            return
        }
        const desc = description.trim()
        if (!desc) {
            toast.error("Describe what the system should do to get started.")
            return
        }
        const effectiveName = projectName.trim() || deriveName(desc) || "Untitled System"

        setIsAnalyzing(true)
        const loadingToast = toast.loading("Initializing analysis...")

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    text: desc,
                    srsData: {
                        introduction: {
                            projectName: { content: effectiveName },
                            purpose: { content: desc },
                        },
                    },
                    projectId: projectId || undefined,
                    settings,
                    draft: true,
                }),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || "Failed to initialize analysis.")
            }

            const json = await response.json()
            const data = json.data || json
            if (data.status === "draft" && data.id) {
                toast.success("Analysis initialized!", { id: loadingToast })
                router.push(`/analysis/${data.id}`)
            } else {
                throw new Error("Unexpected response from server.")
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "Failed to initialize analysis", { id: loadingToast })
        } finally {
            setIsAnalyzing(false)
        }
    }

    const firstName = user?.name?.split(" ")[0]

    return (
        <div className="min-h-[calc(100vh-1px)] flex flex-col items-center justify-center px-4 py-16">
            <div className="w-full max-w-2xl">
                {projectId && (
                    <div className="mb-6 mx-auto w-fit border border-foreground/10 rounded-full px-3 py-1.5 flex items-center gap-2 text-xs">
                        <Folder size={13} className="text-muted-foreground" />
                        <span className="text-muted-foreground">Adding to</span>
                        <strong className="font-medium">{contextProjectName || "…"}</strong>
                    </div>
                )}

                <div className="text-center mb-8">
                    <h1 className="text-3xl lg:text-4xl font-display tracking-tight mb-2">
                        {firstName ? `What are we specifying, ${firstName}?` : "What are we specifying today?"}
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Paste raw stakeholder notes or a rough brief. The pipeline extracts scope,
                        features, and IEEE-830 requirements from plain text.
                    </p>
                </div>

                {/* Chat-style composer — the input layer. A single focused surface: name it,
                    describe it, pick a model, send. */}
                <div className="rounded-2xl border border-foreground/15 bg-background shadow-sm focus-within:border-foreground/30 focus-within:shadow-md transition-all">
                    <input
                        type="text"
                        placeholder="Name your project (optional)"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        disabled={isAnalyzing}
                        className="w-full bg-transparent px-4 pt-3.5 pb-1 text-sm font-medium outline-none placeholder:text-muted-foreground/60 placeholder:font-normal"
                    />
                    <textarea
                        ref={textareaRef}
                        placeholder="Describe what the system should do…"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={isAnalyzing}
                        rows={2}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault()
                                if (!isAnalyzing && description.trim()) handleAnalyze()
                            }
                        }}
                        className="w-full resize-none bg-transparent px-4 pt-1 pb-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/60 min-h-[64px]"
                    />

                    <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-t border-foreground/[0.06]">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 hover:bg-foreground/5 px-2.5 py-1 text-xs transition-colors max-w-[180px]"
                                    >
                                        <Sparkles className="h-3 w-3 shrink-0 text-muted-foreground" />
                                        <span className="truncate">{activeModel.label}</span>
                                        <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 p-4" align="start">
                                    <div className="space-y-4">
                                        <h4 className="font-medium leading-none flex items-center gap-2 text-sm">
                                            <SlidersHorizontal className="h-4 w-4" /> Analysis settings
                                        </h4>

                                        <div className="space-y-2">
                                            <Label htmlFor="model">AI model</Label>
                                            <Select
                                                value={settings.modelName || "gemini-2.5-flash"}
                                                onValueChange={(val) => {
                                                    const model = MODELS.find(m => m.value === val)
                                                    setSettings(prev => ({
                                                        ...prev,
                                                        modelName: val,
                                                        modelProvider: model?.provider as PromptSettings["modelProvider"]
                                                    }))
                                                }}
                                            >
                                                <SelectTrigger id="model" className="h-8">
                                                    <SelectValue placeholder="Select model" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {MODELS.filter(m => configuredProviders.has(PROVIDER_TO_ENUM[m.provider])).map(m => (
                                                        <SelectItem key={m.value} value={m.value}>
                                                            {m.label}{m.hint ? ` · ${m.hint}` : ""}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {onlyGemini && (
                                                <Link href="/settings" className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                                                    <KeyRound className="h-3 w-3" />
                                                    Add an OpenAI, Claude, or Grok key to unlock more models
                                                </Link>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="profile">Analyst persona</Label>
                                            <Select value={settings.profile} onValueChange={(val) => setSettings(prev => ({ ...prev, profile: val }))}>
                                                <SelectTrigger id="profile" className="h-8">
                                                    <SelectValue placeholder="Select profile" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {PROFILES.map(p => (
                                                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <Label>Depth &amp; verbosity</Label>
                                                <span className="text-xs text-muted-foreground">{settings.depth}/5</span>
                                            </div>
                                            <Slider
                                                value={[settings.depth]}
                                                min={1}
                                                max={5}
                                                step={1}
                                                onValueChange={(v: number[]) => setSettings(prev => ({ ...prev, depth: v[0] }))}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <Label>Creative strictness</Label>
                                                <span className="text-xs text-muted-foreground">{settings.strictness}/5</span>
                                            </div>
                                            <Slider
                                                value={[settings.strictness]}
                                                min={1}
                                                max={5}
                                                step={1}
                                                onValueChange={(v: number[]) => setSettings(prev => ({ ...prev, strictness: v[0] }))}
                                            />
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>

                            <span className="hidden sm:inline text-[11px] text-muted-foreground/60 font-mono">
                                Enter to send · Shift+Enter for a new line
                            </span>
                        </div>

                        <Button
                            size="icon"
                            className="h-8 w-8 rounded-full bg-foreground hover:bg-foreground/90 text-background shrink-0 disabled:opacity-40"
                            onClick={handleAnalyze}
                            disabled={isAnalyzing || !description.trim()}
                            aria-label="Start analysis"
                        >
                            {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>

                {onlyGemini && (
                    <Link
                        href="/settings"
                        className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <KeyRound className="h-3.5 w-3.5" />
                        Using the platform Gemini key. Add your own OpenAI, Claude, or Grok key in Settings.
                    </Link>
                )}

                {/* Starter prompts */}
                <div className="mt-8">
                    <p className="text-center text-[11px] font-mono uppercase tracking-wide text-muted-foreground/60 mb-3">
                        Or start from an example
                    </p>
                    <div className="grid sm:grid-cols-2 gap-2">
                        {EXAMPLES.map((ex) => (
                            <button
                                key={ex}
                                type="button"
                                disabled={isAnalyzing}
                                onClick={() => {
                                    setDescription(ex)
                                    textareaRef.current?.focus()
                                }}
                                className={cn(
                                    "text-left text-sm text-muted-foreground rounded-xl border border-foreground/10 px-3.5 py-3",
                                    "hover:border-foreground/25 hover:text-foreground hover:bg-foreground/[0.02] transition-all"
                                )}
                            >
                                {ex}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function NewAnalysisPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-[50vh] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        }>
            <NewAnalysisContent />
        </Suspense>
    )
}
