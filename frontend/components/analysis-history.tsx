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
    version?: number
    title?: string
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
        <div className="relative border-l-2 border-muted ml-3 md:ml-6 space-y-8 pl-6 md:pl-10 py-4">
            {items.map((item) => (
                <div
                    key={item.id}
                    className="relative group cursor-pointer"
                    onClick={() => router.push(`/analysis/${item.id}`)}
                >
                    {/* Timeline Dot */}
                    <span className="absolute -left-[31px] md:-left-[47px] top-5 h-4 w-4 rounded-full border-2 border-primary bg-background group-hover:bg-primary transition-colors duration-300" />

                    <Card className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-border/50 bg-card/50 hover:bg-card hover:border-primary/20">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4 space-y-0">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="h-6 px-2 text-xs font-semibold shrink-0 transition-colors group-hover:border-primary/50 group-hover:text-primary">
                                        v{item.version || 1}
                                    </Badge>
                                    <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors line-clamp-1">
                                        {item.title || "Requirements Analysis"}
                                    </CardTitle>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
                                <Calendar className="h-3.5 w-3.5" />
                                <span className="hidden xs:inline">{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
                            </div>
                        </CardHeader>

                        <CardContent>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                                {item.inputPreview}
                            </p>

                            <div className="flex items-center gap-1 text-xs text-primary font-medium mt-3 opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
                                View Details <ArrowRight className="h-3 w-3" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ))}
        </div>
    )
}
