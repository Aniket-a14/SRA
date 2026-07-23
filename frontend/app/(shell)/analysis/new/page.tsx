"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { fetchProject } from "@/lib/projects-api"
import { PromptSettings } from "@/types/project"
import { toast } from "sonner"
import { Folder, Sparkles, Settings2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

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
    { provider: "google", value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Fast)" },
    { provider: "google", value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (Advanced)" },
    { provider: "openai", value: "gpt-5.6", label: "GPT-5.6 (Smartest)" },
    { provider: "openai", value: "gpt-5.6-luna", label: "GPT-5.6 Luna (Fast)" },
    { provider: "claude", value: "claude-opus-4-8", label: "Claude Opus 4.8 (Smartest)" },
    { provider: "claude", value: "claude-sonnet-5", label: "Claude Sonnet 5 (Fast)" },
    { provider: "grok", value: "grok-4.5", label: "Grok 4.5" },
]

// Gemini runs on the platform's own key — every other provider requires the
// user to have added their own key in Settings (see providerKeyService.js).
const PROVIDER_TO_ENUM: Record<string, string> = {
    google: "GEMINI",
    openai: "OPENAI",
    claude: "CLAUDE",
    grok: "GROK",
}

function NewAnalysisContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { token } = useAuth()
    const projectId = searchParams.get("projectId")

    const [projectName, setProjectName] = useState("")
    const [description, setDescription] = useState("")
    const [settings, setSettings] = useState<PromptSettings>(DEFAULT_SETTINGS)
    const [configuredProviders, setConfiguredProviders] = useState<Set<string>>(new Set(["GEMINI"]))
    const [contextProjectName, setContextProjectName] = useState<string>("")
    const [isAnalyzing, setIsAnalyzing] = useState(false)

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

    const handleAnalyze = async () => {
        if (!token) {
            toast.error("You must be logged in to start an analysis.")
            return
        }
        if (!projectName.trim()) return

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
                    text: description || projectName,
                    srsData: {
                        introduction: {
                            projectName: { content: projectName },
                            purpose: { content: description || projectName },
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

    return (
        <div className="max-w-2xl mx-auto px-6 py-16">
            <div className="text-center mb-10">
                <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-4">
                    <span className="w-8 h-px bg-foreground/30" />
                    New analysis
                </span>
                <h1 className="text-3xl lg:text-4xl font-display tracking-tight mb-3">
                    Describe your system.
                </h1>
                <p className="text-muted-foreground">
                    Paste raw stakeholder notes or a rough brief — the pipeline figures out
                    scope, features, and requirements from plain text.
                </p>
            </div>

            {projectId && (
                <div className="mb-6 border border-foreground/10 px-4 py-3 flex items-center gap-2 text-sm">
                    <Folder size={16} className="text-muted-foreground" />
                    <span>Adding to project: <strong>{contextProjectName || "Loading..."}</strong></span>
                </div>
            )}

            <div className="border border-foreground/10 p-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-foreground/10">
                            <Sparkles className="h-4 w-4" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Give your project a name and describe what it should do. You can
                            refine everything in detail on the next step.
                        </p>
                    </div>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="icon" className="shrink-0" aria-label="Analysis settings">
                                <Settings2 className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-4" align="end">
                            <div className="space-y-4">
                                <h4 className="font-medium leading-none flex items-center gap-2">
                                    <Settings2 className="h-4 w-4" /> Analysis settings
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
                                                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {configuredProviders.size === 1 && (
                                        <p className="text-[10px] text-muted-foreground">
                                            Add an OpenAI, Claude, or Grok key in Settings to unlock more models.
                                        </p>
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
                </div>

                <div className="space-y-3">
                    <Input
                        placeholder="Project name (e.g. Inventory Manager)"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        disabled={isAnalyzing}
                    />
                    <textarea
                        placeholder="Describe what this system needs to do..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={isAnalyzing}
                        rows={5}
                        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    />
                </div>

                <div className="flex justify-end mt-4">
                    <Button
                        className="gap-2 bg-foreground hover:bg-foreground/90 text-background rounded-full"
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || !projectName.trim()}
                    >
                        {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {isAnalyzing ? "Starting..." : "Start analysis"}
                    </Button>
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
