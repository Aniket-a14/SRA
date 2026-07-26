import type { ReactNode } from "react";
import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";

/**
 * Shared shell for /privacy and /terms.
 *
 * There is no `@tailwindcss/typography` in this project, so element styling is declared
 * here rather than reached for with a `prose` class that does not exist. Matches the
 * /changelog page's structure so the legal pages read as part of the product rather than
 * as something bolted on.
 */
export function LegalPage({
    eyebrow,
    title,
    summary,
    lastUpdated,
    children,
}: {
    eyebrow: string;
    title: string;
    summary: string;
    lastUpdated: string;
    children: ReactNode;
}) {
    return (
        <main className="relative min-h-screen noise-overlay">
            <Navigation />

            <div className="border-b border-foreground/10 pt-28 md:pt-36">
                <div className="max-w-3xl mx-auto px-6 lg:px-10 pb-10">
                    <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground mb-4">
                        {eyebrow}
                    </p>
                    <h1 className="text-5xl md:text-6xl font-display tracking-tight mb-5">
                        {title}
                    </h1>
                    <p className="text-muted-foreground leading-relaxed">{summary}</p>
                    <p className="mt-6 font-mono text-xs text-muted-foreground">
                        Last updated {lastUpdated}
                    </p>
                </div>
            </div>

            <article
                className="
                    max-w-3xl mx-auto px-6 lg:px-10 py-14 legal-prose
                    [&_h2]:text-2xl [&_h2]:font-display [&_h2]:tracking-tight [&_h2]:mt-14 [&_h2]:mb-4
                    [&_h3]:text-lg [&_h3]:font-medium [&_h3]:mt-8 [&_h3]:mb-3
                    [&_p]:text-muted-foreground [&_p]:leading-relaxed [&_p]:mb-4
                    [&_ul]:mb-5 [&_ul]:space-y-2 [&_ul]:list-disc [&_ul]:pl-5
                    [&_li]:text-muted-foreground [&_li]:leading-relaxed
                    [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-foreground
                    [&_strong]:text-foreground [&_strong]:font-medium
                    [&_table]:w-full [&_table]:text-sm [&_table]:mb-6
                    [&_th]:text-left [&_th]:font-medium [&_th]:py-2 [&_th]:pr-4 [&_th]:border-b [&_th]:border-foreground/10
                    [&_td]:align-top [&_td]:py-2 [&_td]:pr-4 [&_td]:border-b [&_td]:border-foreground/5 [&_td]:text-muted-foreground
                "
            >
                {children}
            </article>

            <FooterSection />
        </main>
    );
}

/**
 * Callout for the notices a reader must not skim past — currently the fact that these
 * drafts have not been through a lawyer.
 */
export function LegalNotice({ children }: { children: ReactNode }) {
    return (
        <div className="my-8 rounded-lg border border-foreground/15 bg-foreground/[0.03] px-5 py-4">
            <p className="text-sm leading-relaxed !text-foreground !mb-0">{children}</p>
        </div>
    );
}
