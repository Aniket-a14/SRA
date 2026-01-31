"use client"
import { Database, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface SourcesPanelProps {
    sources: string[];
}

export function SourcesPanel({ sources }: SourcesPanelProps) {
    if (!sources || sources.length === 0) return null;

    return (
        <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Database className="h-4 w-4 text-primary" />
                    Knowledge Sources
                </CardTitle>
                <CardDescription className="text-[10px]">
                    Intelligence retrieved from finalized projects via Layer 5 (Granular RAG)
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap gap-2">
                    {sources.map((source, idx) => (
                        <Badge key={idx} variant="secondary" className="bg-white/80 hover:bg-white transition-colors text-[10px] py-0 px-2 flex items-center gap-1 border-primary/10">
                            <Info className="h-3 w-3 text-muted-foreground" />
                            {source}
                        </Badge>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
