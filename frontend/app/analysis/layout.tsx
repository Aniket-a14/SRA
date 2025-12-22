import { AppShell } from "@/components/app-shell"

export default function AnalysisLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <AppShell>{children}</AppShell>
}
