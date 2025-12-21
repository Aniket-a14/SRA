"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface KVDisplayProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any>
    title?: string
    excludeKeys?: string[]
}

// Helper to format camelCase to Title Case
const formatKey = (key: string) => {
    return key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())
        .trim()
}

export function KVDisplay({ data, title, excludeKeys = [] }: KVDisplayProps) {
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
                        // Check if array is empty
                        if (value.length === 0) return null

                        // Check if array contains objects with 'userClass' (User Classes special case)
                        if (typeof value[0] === 'object' && 'userClass' in value[0]) {
                            return (
                                <div key={key}>
                                    <h4 className="text-sm font-medium mb-3 text-primary">{formatKey(key)}</h4>
                                    <div className="grid gap-3">
                                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                        {(value as any[]).map((item, idx) => (
                                            <div key={idx} className="p-3 bg-secondary/30 rounded-md border border-border/50">
                                                <div className="font-semibold text-sm mb-1">{item.userClass}</div>
                                                <div className="text-sm text-muted-foreground">{item.characteristics}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        }

                        // Check if array contains objects with 'term' (Glossary special case)
                        if (typeof value[0] === 'object' && 'term' in value[0]) {
                            // We might want to handle glossary separately, but generic fallback here
                            return (
                                <div key={key}>
                                    <h4 className="text-sm font-medium mb-3 text-primary">{formatKey(key)}</h4>
                                    <dl className="grid gap-3">
                                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                        {(value as any[]).map((item, idx) => (
                                            <div key={idx} className="p-3 bg-secondary/30 rounded-md border border-border/50">
                                                <dt className="font-semibold text-sm mb-1">{item.term}</dt>
                                                <dd className="text-sm text-muted-foreground">{item.definition}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                </div>
                            )
                        }

                        // Normal string array
                        return (
                            <div key={key}>
                                <h4 className="text-sm font-medium mb-2 text-primary">{formatKey(key)}</h4>
                                <ul className="list-disc list-inside space-y-1">
                                    {value.map((item, idx) => (
                                        <li key={idx} className="text-sm text-muted-foreground pl-2 leading-relaxed">
                                            <span className="-ml-2 text-foreground/80">{String(item)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )
                    }

                    // Handle Objects (nested Key-Value, e.g. User Interface types if structured)
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
                                {String(value)}
                            </p>
                        </div>
                    )
                })}
            </CardContent>
        </Card>
    )
}
