import * as React from "react"
import { notFound } from "next/navigation"
import Link from "next/link"
import {
    getDocCategory,
    getAllDocCategories
} from "@/lib/docs-data"
import { DocsToc, type TocItem } from "@/components/docs/docs-toc"
import { DocsCodeBlock } from "@/components/docs/docs-code-block"
import { DocsFeedback } from "@/components/docs/docs-feedback"
import { ArrowLeft, ArrowRight, Clock } from "lucide-react"
import { DocContentRenderer } from "@/components/docs/doc-content-renderer"

interface DocsSlugPageProps {
    params: Promise<{
        slug: string
    }>
}

export async function generateStaticParams() {
    return getAllDocCategories().map((cat) => ({
        slug: cat.slug
    }))
}

export default async function DocsSlugPage({ params }: DocsSlugPageProps) {
    const { slug } = await params
    const category = getDocCategory(slug)

    if (!category) {
        notFound()
    }

    // Build Table of Contents items
    const tocItems: TocItem[] = []
    category.sections.forEach((sec) => {
        tocItems.push({ id: sec.id, title: sec.title, level: 1 })
        sec.subsections?.forEach((sub) => {
            tocItems.push({ id: sub.id, title: sub.title, level: 2 })
        })
    })

    // Compute Previous / Next categories for pagination
    const allCategories = getAllDocCategories()
    const currentIndex = allCategories.findIndex((c) => c.slug === slug)
    const prevCategory = currentIndex > 0 ? allCategories[currentIndex - 1] : null
    const nextCategory = currentIndex < allCategories.length - 1 ? allCategories[currentIndex + 1] : null

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10 sm:py-16">
            <div className="flex flex-col lg:flex-row gap-12">
                {/* Main Content Column */}
                <div className="flex-1 min-w-0 space-y-12">
                    {/* Header */}
                    <div className="space-y-3 border-b border-foreground/10 pb-8">
                        <div className="flex items-center gap-3">
                            <span className="inline-flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/70">
                                <span className="w-6 h-px bg-foreground/30" />
                                {category.badge || "Documentation"}
                            </span>
                            <span className="text-foreground/20">|</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                                <Clock className="h-3 w-3" />
                                ~{Math.max(3, category.sections.length * 2)} min read
                            </span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-display font-medium tracking-tight text-foreground">
                            {category.title}
                        </h1>
                        <p className="text-sm text-muted-foreground leading-relaxed font-sans max-w-2xl">
                            {category.description}
                        </p>
                    </div>

                    {/* Render Each Section */}
                    <div className="space-y-14">
                        {category.sections.map((section, idx) => (
                            <section key={section.id} id={section.id} className="space-y-6 scroll-mt-20">
                                <div className="space-y-1.5 border-b border-foreground/10 pb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-[10px] text-muted-foreground/50">
                                            0{idx + 1}
                                        </span>
                                        <h2 className="text-xl font-display font-medium text-foreground">
                                            {section.title}
                                        </h2>
                                    </div>
                                    {section.summary && (
                                        <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                                            {section.summary}
                                        </p>
                                    )}
                                </div>

                                <div className="pl-0 sm:pl-6 space-y-4">
                                    <DocContentRenderer content={section.content} />

                                    {/* Subsections */}
                                    {section.subsections && section.subsections.length > 0 && (
                                        <div className="space-y-8 pl-4 border-l border-foreground/10 mt-6">
                                            {section.subsections.map((sub) => (
                                                <div key={sub.id} id={sub.id} className="space-y-3 scroll-mt-20">
                                                    <h3 className="text-base font-display font-medium text-foreground">
                                                        {sub.title}
                                                    </h3>
                                                    <DocContentRenderer content={sub.content} />
                                                    {sub.codeSnippet && (
                                                        <DocsCodeBlock
                                                            language={sub.codeSnippet.language}
                                                            code={sub.codeSnippet.code}
                                                            tabs={sub.codeSnippet.tabs}
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </section>
                        ))}
                    </div>

                    {/* Feedback Widget */}
                    <DocsFeedback />

                    {/* Pagination Navigation Footer */}
                    <div className="flex items-center justify-between gap-4 pt-8 border-t border-foreground/10">
                        {prevCategory ? (
                            <Link
                                href={`/docs/${prevCategory.slug}`}
                                className="group p-4 border border-foreground/10 hover:border-foreground/30 transition-all flex flex-col items-start gap-1 max-w-[45%]"
                            >
                                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                                    <ArrowLeft className="h-3 w-3 group-hover:-translate-x-1 transition-transform" />
                                    Previous
                                </span>
                                <span className="text-xs font-semibold text-foreground truncate w-full">
                                    {prevCategory.shortTitle || prevCategory.title}
                                </span>
                            </Link>
                        ) : (
                            <div />
                        )}

                        {nextCategory ? (
                            <Link
                                href={`/docs/${nextCategory.slug}`}
                                className="group p-4 border border-foreground/10 hover:border-foreground/30 transition-all flex flex-col items-end text-right gap-1 max-w-[45%]"
                            >
                                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                                    Next
                                    <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                                </span>
                                <span className="text-xs font-semibold text-foreground truncate w-full">
                                    {nextCategory.shortTitle || nextCategory.title}
                                </span>
                            </Link>
                        ) : (
                            <div />
                        )}
                    </div>
                </div>

                {/* Right Column: In-page TOC on Desktop */}
                <div className="hidden lg:block w-60 shrink-0">
                    <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
                        <DocsToc items={tocItems} />
                    </div>
                </div>
            </div>
        </div>
    )
}
