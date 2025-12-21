"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getAcronym } from "@/lib/utils"

interface KVDisplayProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any>
    title?: string
    excludeKeys?: string[]
    projectTitle?: string
}

// Helper to format camelCase to Title Case
const formatKey = (key: string) => {
    return key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())
        .trim()
}

// Helper to render bold text from markdown
const renderMarkdown = (text: string) => {
    if (!text) return null;
    return text.split(/(\*\*.*?\*\*)/g).map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={idx} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
        }
        return <span key={idx}>{part}</span>;
    });
};

const ID_MAPPING: Record<string, string> = {
    performanceRequirements: "PR",
    safetyRequirements: "SR",
    securityRequirements: "SE",
    softwareQualityAttributes: "QA",
    businessRules: "BR",
    otherRequirements: "OR"
};

export function KVDisplay({ data, title, excludeKeys = [], projectTitle = "SRA" }: KVDisplayProps) {
    const acronym = getAcronym(projectTitle);

    if (!data || Object.keys(data).length === 0) return null

    const validKeys = Object.keys(data).filter(key => !excludeKeys.includes(key))

    if (validKeys.length === 0) return null

    return (
        <Card className="bg-card border-border h-full">
            {title && (
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{title}</CardTitle>
                </CardHeader>
            )}
            <CardContent className="space-y-6 pt-4">
                {validKeys.map((key) => {
                    const value = data[key]
                    if (!value) return null

                    // Handle Arrays (List of string items)
                    if (Array.isArray(value)) {
                        if (value.length === 0) return null

                        // Check if array contains objects with 'userClass'
                        if (typeof value[0] === 'object' && 'userClass' in value[0]) {
                            return (
                                <div key={key}>
                                    <h4 className="text-sm font-medium mb-3 text-primary">{formatKey(key)}</h4>
                                    <div className="grid gap-3">
                                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                        {(value as any[]).map((item, idx) => (
                                            <div key={idx} className="p-3 bg-secondary/30 rounded-md border border-border/50">
                                                <div className="font-semibold text-sm mb-1">{renderMarkdown(item.userClass)}</div>
                                                <div className="text-sm text-muted-foreground">{renderMarkdown(item.characteristics)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        }

                        // Check if array contains objects with 'term'
                        if (typeof value[0] === 'object' && 'term' in value[0]) {
                            return (
                                <div key={key}>
                                    <h4 className="text-sm font-medium mb-3 text-primary">{formatKey(key)}</h4>
                                    <dl className="grid gap-3">
                                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                        {(value as any[]).map((item, idx) => (
                                            <div key={idx} className="p-3 bg-secondary/30 rounded-md border border-border/50">
                                                <dt className="font-semibold text-sm mb-1">{renderMarkdown(item.term)}</dt>
                                                <dd className="text-sm text-muted-foreground">{renderMarkdown(item.definition)}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                </div>
                            )
                        }

                        const idCode = ID_MAPPING[key];

                        if (idCode) {
                            // Render with Requirement IDs
                            return (
                                <div key={key}>
                                    <h4 className="text-sm font-medium mb-2 text-primary">{formatKey(key)}</h4>
                                    <div className="grid gap-2">
                                        {(value as string[]).map((item, idx) => {
                                            const cleanItem = item.replace(/^[A-Z]+-[A-Z]+-\d+\s*:?\s*/, '').trim();
                                            // Only strip regex ID. But if bullet? strip bullet too.
                                            const finalItem = cleanItem.replace(/^\s*(?:[\-\•\d\.\)]+\s*|\*(?!\*)\s*)/, '').trim();

                                            return (
                                                <div key={idx} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                                                    <Badge variant="outline" className="shrink-0 mt-0.5 text-xs text-muted-foreground bg-muted/20 border-muted-foreground/20">
                                                        {acronym}-{idCode}-{idx + 1}
                                                    </Badge>
                                                    <span className="text-sm text-muted-foreground leading-relaxed">{renderMarkdown(finalItem)}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        }

                        // Normal string array (bullets)
                        return (
                            <div key={key}>
                                <h4 className="text-sm font-medium mb-2 text-primary">{formatKey(key)}</h4>
                                <ul className="list-disc list-inside space-y-1">
                                    {value.map((item, idx) => (
                                        <li key={idx} className="text-sm text-muted-foreground pl-2 leading-relaxed">
                                            <span className="-ml-2 text-foreground/80">{renderMarkdown(String(item))}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )
                    }

                    // Handle Objects
                    if (typeof value === 'object') {
                        return (
                            <div key={key}>
                                <h4 className="text-sm font-medium mb-2 text-primary">{formatKey(key)}</h4>
                                <pre className="text-xs bg-secondary p-2 rounded overflow-auto">
                                    {JSON.stringify(value, null, 2)}
                                </pre>
                            </div>
                        )
                    }

                    // Handle Strings
                    return (
                        <div key={key}>
                            <h4 className="text-sm font-medium mb-1 text-primary">{formatKey(key)}</h4>
                            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                                {renderMarkdown(String(value))}
                            </p>
                        </div>
                    )
                })}
            </CardContent>
        </Card>
    )
}
