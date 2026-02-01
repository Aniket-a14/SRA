import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"

import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Sparkles, Settings2 } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { PromptSettings } from "@/types/project"
import { useAuth } from "@/lib/auth-context"
import { updateProject } from "@/lib/projects-api"
import { useSearchParams } from "next/navigation"
import { throttle } from "@/lib/utils"

interface ChatInputProps {
  onAnalyze: (requirements: string, settings: PromptSettings, projectName: string) => void
  isLoading: boolean
  initialSettings?: PromptSettings
}

const DEFAULT_SETTINGS: PromptSettings = {
  profile: "default",
  depth: 3,
  strictness: 3,
  modelProvider: "google",
  modelName: "gemini-2.5-flash"
};

const PROFILES = [
  { value: "default", label: "General Software (Default)" },
  { value: "business_analyst", label: "Business Analyst (ROI Focused)" },
  { value: "system_architect", label: "System Architect (Tech Focused)" },
  { value: "security_analyst", label: "Security Analyst (Safety Focused)" },
];

const MODELS = [
  { provider: "google", value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Fast)" },
  { provider: "openai", value: "gpt-4o", label: "GPT-4o (Smartest)" },
  { provider: "openai", value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo (Fast)" },
];

export function ChatInput({ onAnalyze, isLoading, initialSettings }: ChatInputProps) {
  const sectionRef = useRef<HTMLElement>(null)

  const [projectName, setProjectName] = useState("")
  const [settings, setSettings] = useState<PromptSettings>(initialSettings || DEFAULT_SETTINGS);
  const { token } = useAuth();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");

  // Sync initial setup
  // Sync initial setup
  useEffect(() => {
    if (initialSettings && JSON.stringify(settings) !== JSON.stringify(initialSettings)) {
      setSettings(initialSettings);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSettings]);

  // Debounced Save
  useEffect(() => {
    if (!token || !projectId) return;

    // Don't save if it matches initial exactly (prevents loop/unnecessary calls on mount)
    // Simple check: JSON stringify
    if (JSON.stringify(settings) === JSON.stringify(initialSettings)) return;

    const timeout = setTimeout(async () => {
      try {
        await updateProject(token, projectId, { settings });
        // Optional: toast.success("Settings saved");
      } catch (e) {
        console.error("Failed to save settings", e);
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [settings, token, projectId, initialSettings]);


  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-scale-in")
          }
        })
      },
      { threshold: 0.1 },
    )

    const elements = sectionRef.current?.querySelectorAll(".animate-on-scroll")
    elements?.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])



  const handleProfileChange = (val: string) => {
    setSettings(prev => ({ ...prev, profile: val }));
  };

  return (
    <section id="analyzer" ref={sectionRef} className="py-10 sm:py-14">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8 animate-on-scroll opacity-0">
            <h2 className="text-xl sm:text-2xl font-semibold mb-2">Create New Project</h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              Describe your project vision to get started with the Structured Analysis Pipeline.
            </p>
          </div>

          <Card className="p-3 sm:p-4 bg-card border-border animate-on-scroll opacity-0 delay-200 transition-all duration-500 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10">
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 animate-pulse-glow">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-3">
                      Hello! I can help you build a professional IEEE-830 SRS. Start by describing your project goal, and we&apos;ll refine it layer by layer through our 5-stage pipeline.
                    </p>
                  </div>
                </div>

                {/* Settings Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="shrink-0 text-muted-foreground hover:text-primary" aria-label="Project settings">
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-4" align="end">
                    <div className="space-y-4">
                      <h4 className="font-medium leading-none flex items-center gap-2">
                        <Settings2 className="h-4 w-4 text-primary" /> Project Settings
                      </h4>
                      <p className="text-xs text-muted-foreground">Customize how the AI analyzes your requirements.</p>

                      {/* MODEL SELECT */}
                      <div className="space-y-2">
                        <Label htmlFor="model">AI Model</Label>
                        <Select
                          value={settings.modelName || "gemini-2.5-flash"}
                          onValueChange={(val) => {
                            const model = MODELS.find(m => m.value === val);
                            setSettings(prev => ({
                              ...prev,
                              modelName: val,
                              modelProvider: model?.provider as 'google' | 'openai'
                            }));
                          }}
                        >
                          <SelectTrigger id="model" className="h-8">
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                          <SelectContent>
                            {MODELS.map(m => (
                              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* PROFILE SELECT */}
                      <div className="space-y-2">
                        <Label htmlFor="profile">Analyst Persona</Label>
                        <Select value={settings.profile} onValueChange={handleProfileChange}>
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

                      {/* DEPTH SLIDER */}
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label>Depth & Verbosity</Label>
                          <span className="text-xs text-muted-foreground">{settings.depth}/5</span>
                        </div>
                        <Slider
                          value={[settings.depth]}
                          min={1}
                          max={5}
                          step={1}
                          onValueChange={(v: number[]) => setSettings(prev => ({ ...prev, depth: v[0] }))}
                          className="py-2"
                        />
                        <p className="text-[10px] text-muted-foreground flex justify-between">
                          <span>Concise</span>
                          <span>Detailed</span>
                        </p>
                      </div>

                      {/* STRICTNESS SLIDER */}
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label>Creative Strictness</Label>
                          <span className="text-xs text-muted-foreground">{settings.strictness}/5</span>
                        </div>
                        <Slider
                          value={[settings.strictness]}
                          min={1}
                          max={5}
                          step={1}
                          onValueChange={(v: number[]) => setSettings(prev => ({ ...prev, strictness: v[0] }))}
                          className="py-2"
                        />
                        <p className="text-[10px] text-muted-foreground flex justify-between">
                          <span>Imaginative</span>
                          <span>Strict</span>
                        </p>
                      </div>

                      {projectId && <p className="text-[10px] text-primary pt-2 flex items-center justify-end gap-1">Auto-saving to project</p>}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="relative group">
                <Input
                  placeholder="Project Name (e.g. HealthGuard AI)"
                  aria-label="Project Name"
                  className="bg-secondary border-0 text-sm placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/50 mb-3"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  disabled={isLoading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      if (projectName.trim() && !isLoading) {
                        onAnalyze(projectName, settings, projectName)
                      }
                    }
                  }}
                />
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground order-2 sm:order-1">
                  Press Enter to start, moving to Layer 1 (Input)
                </p>
                <Button
                  className="gap-2 bg-primary hover:bg-primary/90 w-full sm:w-auto order-1 sm:order-2 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-primary/25"
                  onClick={throttle(() => onAnalyze(projectName, settings, projectName), 2000)}
                  disabled={isLoading || !projectName.trim()}
                >
                  <Sparkles className="h-4 w-4" />
                  {isLoading ? "Starting..." : "Start Project"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  )
}
