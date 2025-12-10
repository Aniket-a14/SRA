"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, ArrowRight, FileText } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface AnalysisHistoryItem {
    id: string
    createdAt: string
    inputText: string
    inputPreview: string
}

interface AnalysisHistoryProps {
    items: AnalysisHistoryItem[]
}

export function AnalysisHistory({ items }: AnalysisHistoryProps) {
    const router = useRouter()

    if (items.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">No analyses yet</h3>
                <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                    Start by entering your project requirements in the analyzer on the home page.
                </p>
            </div>
        )
    }

    return (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
                <Card
                    key={item.id}
                    className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer border-border/50 bg-card/50 hover:bg-card hover:border-primary/20"
                    onClick={() => router.push(`/analysis/${item.id}`)}
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline" className="w-fit transition-colors group-hover:border-primary/50 group-hover:text-primary">
                                Analysis
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-primary" />
                        </div>
                        <CardTitle className="text-base font-medium line-clamp-1 group-hover:text-primary transition-colors">
                            Project Requirements
                        </CardTitle>
                    </CardHeader>

                    <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-4 min-h-[3.75rem]">
                            {item.inputPreview}
                        </p>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-auto pt-4 border-t border-border/50">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
