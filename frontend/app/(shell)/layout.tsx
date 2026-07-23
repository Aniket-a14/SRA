import { AppShell } from "@/components/app-shell"

// Shared across /analysis and /projects via this route group (no URL segment of its
// own), so the sidebar and its data fetch persist across navigation instead of
// remounting on every transition.
export default function ShellLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <AppShell>{children}</AppShell>
}
