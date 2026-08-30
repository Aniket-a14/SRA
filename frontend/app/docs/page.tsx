"use client"

import * as React from "react"
import Link from "next/link"
import {
    Sparkles,
    Cpu,
    FileText,
    Terminal,
    Code,
    ShieldCheck,
    Server,
    BookOpen,
    ArrowRight,
    Lock,
    GitBranch,
    ListFilter,
    Share2,
    Check,
    ArrowUp
} from "lucide-react"
import { DOCS_CATEGORIES } from "@/lib/docs-data"
import { DocsCodeBlock } from "@/components/docs/docs-code-block"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import dynamic from "next/dynamic"

const MermaidRenderer = dynamic(() => import("@/components/mermaid-renderer").then(m => m.MermaidRenderer), {
    loading: () => <div className="h-[280px] w-full bg-muted/5 animate-pulse" />,
    ssr: false
})

const ICON_MAP: Record<string, React.ElementType> = {
    Sparkles,
    Cpu,
    FileText,
    Terminal,
    Code,
    ShieldCheck,
    Server,
    BookOpen
}

const ARCHITECTURE_CHART = `graph TD
    UI[Next.js 16 Workspace] -->|REST / JWT| Gateway[API Gateway]
    Gateway -->|Verify Session| Auth[Auth & RLS Service]
    Gateway -->|Dispatch Job| QStash[Upstash QStash Queue]
    QStash --> Worker[Serverless Worker]
    Worker --> L1[L1: Intake Mapping]
    L1 --> L2[L2: Multi-Agent MAS]
    L2 --> L3[L3: 6Cs & RAG Audit]
    L3 --> L4[L4: Refinement Hub]
    L4 --> L5[L5: Knowledge Indexer]
    L5 --> VectorDB[(Supabase pgvector)]
    CLI[SRA CLI @sra-srs/sra-cli] -->|Bi-directional Sync| Gateway`

export default function DocsOverviewPage() {
    const [copied, setCopied] = React.useState(false)

    const copyPageLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href)
            setCopied(true)
            toast.success("Page link copied to clipboard")
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error("Failed to copy link")
        }
    }

    return (
        <div className="flex min-h-full">
            {/* Center Content Column */}
            <div className="flex-1 min-w-0 max-w-4xl px-6 sm:px-10 py-10 sm:py-14 space-y-16">
                {/* Hero Section */}
                <div className="space-y-4 border-b border-foreground/10 pb-10">
                    <div className="inline-flex items-center gap-3 text-xs font-mono text-muted-foreground">
                        <span className="w-6 h-px bg-foreground/30" />
                        <span>Documentation & Reference</span>
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-display leading-[1.05] tracking-tight text-foreground">
                        Smart Requirements Analyzer
                    </h1>
                    <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl font-sans">
                        Complete technical reference, architecture blueprints, specification standards, developer CLI guides, and REST API contracts for the SRA multi-agent requirements platform.
                    </p>
                </div>

                {/* Architecture Blueprint Card */}
                <div id="blueprint" className="border border-foreground/10 bg-background p-6 sm:p-8 space-y-6 scroll-mt-20">
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-foreground/10 pb-4">
                        <div>
                            <span className="inline-flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/70">
                                <span className="w-6 h-px bg-foreground/30" />
                                System Blueprint
                            </span>
                            <h2 className="text-2xl font-display font-medium mt-1">Multi-Layer Manufacturing Pipeline</h2>
                        </div>
                        <span className="font-mono text-xs text-muted-foreground">
                            v4.2.2 Architecture
                        </span>
                    </div>

                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                        SRA treats requirements engineering as an asynchronous manufacturing process. Rather than unreliable one-shot prompting, requirements undergo multi-agent synthesis, deterministic 6Cs auditing, and bi-directional code traceability.
                    </p>

                    {/* Mermaid Architecture Chart */}
                    <div className="p-4 border border-foreground/10 bg-muted/5 overflow-hidden">
                        <MermaidRenderer chart={ARCHITECTURE_CHART} title="SRA Architecture Blueprint" />
                    </div>

                    {/* System Guarantees */}
                    <div className="grid sm:grid-cols-2 gap-4 pt-2">
                        <div className="p-4 border border-foreground/10 bg-muted/5 space-y-1">
                            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                                <GitBranch className="h-4 w-4 text-emerald-600" />
                                <span>Recursive Versioning Tree</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-normal">
                                All revisions branch non-destructively via <code className="font-mono text-[10px]">rootId</code> and <code className="font-mono text-[10px]">parentId</code> to preserve complete audit history.
                            </p>
                        </div>

                        <div className="p-4 border border-foreground/10 bg-muted/5 space-y-1">
                            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                                <Lock className="h-4 w-4 text-primary" />
                                <span>Zero-Trust BYOK Security</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-normal">
                                Customer API keys are encrypted with AES-256-GCM, never logged, and loaded only in ephemeral memory during execution.
                            </p>
                        </div>
                    </div>
                </div>

                {/* The 8 Enterprise Pillars Grid */}
                <div id="pillars" className="space-y-6 scroll-mt-20">
                    <div className="border-b border-foreground/10 pb-4">
                        <span className="inline-flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/70">
                            <span className="w-6 h-px bg-foreground/30" />
                            Knowledge Base
                        </span>
                        <h2 className="text-2xl font-display font-medium mt-1">Documentation Pillars</h2>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                        {DOCS_CATEGORIES.map((cat, idx) => {
                            const Icon = ICON_MAP[cat.icon] || FileText

                            return (
                                <Link
                                    key={cat.id}
                                    href={`/docs/${cat.slug}`}
                                    className="group p-5 border border-foreground/10 bg-background hover:bg-muted/10 transition-all flex flex-col justify-between"
                                >
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-[10px] text-muted-foreground/50">
                                                    0{idx + 1}
                                                </span>
                                                <div className="p-1.5 border border-foreground/10 bg-foreground/5 text-foreground group-hover:bg-foreground group-hover:text-background transition-colors">
                                                    <Icon className="h-4 w-4" />
                                                </div>
                                            </div>
                                            {cat.badge && (
                                                <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 border border-foreground/10 text-muted-foreground">
                                                    {cat.badge}
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="font-display font-semibold text-base text-foreground group-hover:text-primary transition-colors">
                                                {cat.title}
                                            </h3>
                                            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2 font-sans">
                                                {cat.description}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 text-xs font-medium text-foreground/80 mt-4 pt-3 border-t border-foreground/5">
                                        <span>Read {cat.sections.length} topics</span>
                                        <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                </div>

                {/* Quickstart Execution */}
                <div id="quickstart" className="border border-foreground/10 bg-background p-6 sm:p-8 space-y-4 scroll-mt-20">
                    <div className="space-y-1 border-b border-foreground/10 pb-3">
                        <span className="inline-flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/70">
                            <span className="w-6 h-px bg-foreground/30" />
                            Quick Execution
                        </span>
                        <h3 className="text-lg font-display font-semibold">Start with the SRA CLI</h3>
                        <p className="text-xs text-muted-foreground">
                            Integrate requirements synthesis and verification into your local development terminal in under 2 minutes:
                        </p>
                    </div>

                    <DocsCodeBlock
                        tabs={[
                            {
                                label: "npm",
                                language: "bash",
                                code: `# Install CLI globally\nnpm install -g @sra-srs/sra-cli\n\n# Authenticate session\nsra auth login\n\n# Analyze intent and stream real-time progress\nsra analyze -i requirements.md -f ieee830 --watch\n\n# Sync specification locally\nsra sync`
                            },
                            {
                                label: "pnpm",
                                language: "bash",
                                code: `pnpm add -g @sra-srs/sra-cli\nsra auth login\nsra analyze -i requirements.md -f volere -w\nsra sync`
                            }
                        ]}
                    />
                </div>
            </div>

            {/* Right-Hand Structure Sidebar for Overview */}
            <div className="hidden lg:block w-72 shrink-0 border-l border-foreground/10">
                <div className="sticky top-13 max-h-[calc(100vh-3.25rem)] overflow-hidden">
                    <aside className="flex flex-col h-full bg-background/50 p-5 space-y-6 text-xs select-none">
                        {/* Page Structure */}
                        <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/70 font-semibold flex items-center gap-1.5">
                                    <ListFilter className="h-3.5 w-3.5 text-primary" />
                                    Portal Structure
                                </p>
                            </div>

                            <nav className="space-y-1 border-l border-foreground/10 pl-2 ml-1">
                                <a
                                    href="#blueprint"
                                    className="block py-1 px-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/10 transition-colors font-medium"
                                >
                                    01. System Blueprint
                                </a>
                                <a
                                    href="#pillars"
                                    className="block py-1 px-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/10 transition-colors font-medium"
                                >
                                    02. Documentation Pillars (8)
                                </a>
                                <div className="ml-3 pl-2 border-l border-foreground/10 space-y-0.5 my-0.5">
                                    {DOCS_CATEGORIES.map((cat, cIdx) => (
                                        <Link
                                            key={cat.id}
                                            href={`/docs/${cat.slug}`}
                                            className="block py-0.5 px-1 text-[11px] text-muted-foreground/70 hover:text-foreground truncate font-sans"
                                        >
                                            {cIdx + 1}. {cat.shortTitle || cat.title}
                                        </Link>
                                    ))}
                                </div>
                                <a
                                    href="#quickstart"
                                    className="block py-1 px-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/10 transition-colors font-medium"
                                >
                                    03. SRA CLI Quickstart
                                </a>
                            </nav>
                        </div>



                        {/* Quick Actions */}
                        <div className="space-y-1.5 pt-2 border-t border-foreground/10">
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full justify-start gap-2 h-7 text-xs border-foreground/10 text-muted-foreground hover:text-foreground"
                                onClick={copyPageLink}
                            >
                                {copied ? (
                                    <>
                                        <Check className="h-3 w-3 text-emerald-600" />
                                        <span>Link Copied</span>
                                    </>
                                ) : (
                                    <>
                                        <Share2 className="h-3 w-3" />
                                        <span>Share Overview Link</span>
                                    </>
                                )}
                            </Button>

                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start gap-2 h-7 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                            >
                                <ArrowUp className="h-3 w-3" />
                                <span>Back to Top</span>
                            </Button>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    )
}
