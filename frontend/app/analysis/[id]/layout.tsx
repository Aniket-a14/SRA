import { ReactNode } from "react"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    return {
        title: `Analysis ${id.substring(0, 8)} | SRA`,
        description: "Intelligent system requirements analysis and diagram generation."
    }
}

export default function AnalysisLayout({ children }: { children: ReactNode }) {
    return <>{children}</>
}
