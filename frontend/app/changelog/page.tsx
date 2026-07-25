import type { Metadata } from "next";
import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";
import { ChangelogTimeline } from "@/components/changelog/changelog-timeline";
import { releases } from "@/content/changelog";
import { formatChangelogDate } from "@/lib/changelog";

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "Release notes for the SRA platform — the multi-agent analysis pipeline, the multi-format specification engine, the CLI, and the infrastructure underneath them.",
};

export default function ChangelogPage() {
  const [latest] = releases;

  return (
    // No `overflow-x-hidden` here, unlike the landing page: it makes this element a
    // scroll container, which silently stops the sticky date rail from pinning.
    // Nothing on this page overflows horizontally to need clipping.
    <main className="relative min-h-screen noise-overlay">
      <Navigation />

      <div className="border-b border-foreground/10 pt-28 md:pt-36">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 pb-10">
          <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground mb-4">
            Release notes
          </p>
          <h1 className="text-5xl md:text-6xl font-display tracking-tight mb-5">
            Changelog
          </h1>
          <p className="text-muted-foreground max-w-2xl leading-relaxed">
            What shipped in the analysis pipeline, the specification engine and the CLI,
            and what each release means for the work you do with them.
            {latest && (
              <>
                {" "}
                The current release is{" "}
                <span className="text-foreground font-medium">v{latest.version}</span>,
                published {formatChangelogDate(latest.date)}.
              </>
            )}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 lg:px-10 pt-12">
        <ChangelogTimeline releases={releases} />
      </div>

      <FooterSection />
    </main>
  );
}
