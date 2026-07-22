import { AppShell } from "@/components/app-shell"

// Shared across /analysis and /projects via this route group (no URL segment of its
// own) — previously each had its own layout.tsx independently wrapping <AppShell>,
// so navigating between an analysis and a project remounted the sidebar and its data
// fetch on every transition instead of persisting across it.
export default function ShellLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <AppShell>{children}</AppShell>
}
