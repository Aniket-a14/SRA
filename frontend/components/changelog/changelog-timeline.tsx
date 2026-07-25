import { formatChangelogDate, type Release } from "@/lib/changelog";

// A server component: the release notes are static MDX compiled at build time, so
// nothing here needs to run in the browser. Interactivity inside a note (the
// collapsible sections) comes from the client components the MDX itself uses.
export function ChangelogTimeline({ releases }: { releases: Release[] }) {
  return (
    <div className="relative">
      {releases.map(({ Content, ...release }) => (
        <article key={release.version} className="relative">
          <div className="flex flex-col md:flex-row gap-y-4">
            {/* Left rail — date and version, pinned while the release scrolls past */}
            <div className="md:w-48 shrink-0">
              <div className="md:sticky md:top-28 pb-10">
                <time
                  dateTime={release.date}
                  className="block mb-3 text-sm font-medium text-muted-foreground"
                >
                  {formatChangelogDate(release.date)}
                </time>
                <span
                  className={`inline-flex relative z-10 items-center justify-center h-7 px-2.5 rounded-lg border font-mono text-xs font-medium ${
                    release.milestone
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background border-foreground/15"
                  }`}
                >
                  {release.version}
                </span>
              </div>
            </div>

            {/* Right column — the release note itself. `min-w-0` because a flex item
                defaults to min-width:auto, which sizes to its widest unbreakable run
                and would push wide code or tables past the viewport. */}
            <div className="flex-1 min-w-0 md:pl-8 relative pb-16">
              {/* Vertical rule with this release's dot on it */}
              <div className="hidden md:block absolute top-2 left-0 w-px h-full bg-foreground/10">
                <div className="absolute -translate-x-1/2 size-3 rounded-full bg-foreground z-10" />
              </div>

              <div className="relative z-10">
                <h2 className="text-2xl md:text-3xl font-display tracking-tight text-balance mb-3">
                  {release.title}
                </h2>

                {release.tags && release.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {release.tags.map((tag) => (
                      <span
                        key={tag}
                        className="h-6 w-fit px-2.5 flex items-center justify-center rounded-full border border-foreground/10 bg-foreground/[0.04] text-xs font-medium text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <p className="mb-8 text-base leading-relaxed text-foreground/80 text-balance">
                  {release.description}
                </p>

                {/* `release-note` scopes the inline-code styling that has to reach
                    JSX authored inside the MDX — see globals.css. */}
                <div className="release-note">
                  <Content />
                </div>
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
