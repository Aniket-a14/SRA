"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getAcronym } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"
import { EditableSection } from "@/components/editable-section"

interface KVDisplayProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any>
    title?: string
    excludeKeys?: string[]
    projectTitle?: string
    isEditing?: boolean
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onUpdate?: (newData: Record<string, any>) => void
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

export function KVDisplay({ data, title, excludeKeys = [], projectTitle = "SRA", isEditing, onUpdate }: KVDisplayProps) {
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
                    if (!value && !isEditing) return null

                    // 1. Handle Arrays
                    if (Array.isArray(value)) {
                        // Check for specialized object arrays
                        if (value.length > 0 && typeof value[0] === 'object') {
                            // User Classes (UserCharacteristic)
                            if ('userClass' in value[0]) {
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
                                            {isEditing && <p className="text-xs text-muted-foreground italic">Complex object editing not yet supported.</p>}
                                        </div>
                                    </div>
                                )
                            }
                            // Glossary Terms
                            if ('term' in value[0]) {
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
                                            {isEditing && <p className="text-xs text-muted-foreground italic">Complex object editing not yet supported.</p>}
                                        </dl>
                                    </div>
                                )
                            }
                        }

                        // String Arrays (Requirements Lists)
                        // Requirements with IDs
                        const idCode = ID_MAPPING[key];
                        // If it's a string array, and we are editing
                        if (isEditing && onUpdate) {
                            return (
                                <div key={key}>
                                    <h4 className="text-sm font-medium mb-2 text-primary">{formatKey(key)}</h4>
                                    <EditableSection
                                        items={value as string[]}
                                        isEditing={true}
                                        onUpdate={(newItems) => onUpdate({ ...data, [key]: newItems })}
                                        prefix={idCode ? `${acronym}-${idCode}` : undefined}
                                    />
                                </div>
                            )
                        }


                        if (idCode) {
                            // Render with Requirement IDs (View Mode)
                            return (
                                <div key={key}>
                                    <h4 className="text-sm font-medium mb-2 text-primary">{formatKey(key)}</h4>
                                    <div className="grid gap-2">
                                        {(value as string[]).map((item, idx) => {
                                            if (typeof item !== 'string') return null;
                                            const cleanItem = item.replace(/^[A-Z]+-[A-Z]+-\d+\s*:?\s*/, '').trim();
                                            const finalItem = cleanItem.replace(/^\s*(?:[\-\•\d\.\)]+\s*|\*(?!\*)\s*)/, '').trim();

                                            // Pre-clean standard bold patterns to avoid split confusion
                                            let work = finalItem;
                                            // 1. **Title:** -> Title:
                                            // Using [\s\S] instead of /s flag for compatibility
                                            work = work.replace(/^\*\*([\s\S]*?):\*\*/, '$1:');
                                            // 2. **Title**: -> Title:
                                            work = work.replace(/^\*\*([\s\S]*?)\*\*:/, '$1:');
                                            // 3. **Title: -> Title:
                                            work = work.replace(/^\*\*([\s\S]*?):/, '$1:');

                                            // 4. Also handle case where the whole line is bolded: **Title: Description** -> Title: Description
                                            // If starts and ends with **, and middle has :, strip outer **
                                            if (work.startsWith('**') && work.endsWith('**') && work.includes(':')) {
                                                work = work.substring(2, work.length - 2);
                                            }

                                            // Now split
                                            const separatorIndex = work.indexOf(':');
                                            let titlePart = "";
                                            let descPart = work;

                                            if (separatorIndex !== -1) {
                                                titlePart = work.substring(0, separatorIndex).trim();
                                                descPart = work.substring(separatorIndex + 1).trim();

                                                // Clean Title: remove wrapping **, * (just in case pre-clean missed something complex)
                                                titlePart = titlePart.replace(/^[\s*]+|[\s*]+$/g, '');

                                                // Clean Description:
                                                // Handle ** at start (from "Title: **Description**")
                                                // Aggressively match leading **...** block if present
                                                descPart = descPart.replace(/^\*\*([\s\S]*?)\*\*/, '$1');

                                                // Handle single leading ** (open bold)
                                                if (descPart.startsWith('**')) {
                                                    descPart = descPart.substring(2);
                                                }
                                            }

                                            return (
                                                <div key={idx} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                                                    <Badge variant="outline" className="shrink-0 mt-0.5 text-xs text-muted-foreground bg-muted/20 border-muted-foreground/20">
                                                        {acronym}-{idCode}-{idx + 1}
                                                    </Badge>
                                                    <span className="text-sm text-muted-foreground leading-relaxed">
                                                        {titlePart ? (
                                                            <>
                                                                <strong className="font-semibold text-foreground">{titlePart}</strong>: {renderMarkdown(descPart)}
                                                            </>
                                                        ) : (
                                                            renderMarkdown(finalItem)
                                                        )}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        }

                        // Normal string array (bullets) - View Mode
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

                    // 2. Handle Objects (Generic)
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

                    // 3. Handle Strings
                    return (
                        <div key={key}>
                            <h4 className="text-sm font-medium mb-1 text-primary">{formatKey(key)}</h4>
                            {isEditing && onUpdate ? (
                                <Textarea
                                    value={String(value)}
                                    onChange={(e) => onUpdate({ ...data, [key]: e.target.value })}
                                    className="min-h-[100px] text-sm"
                                />
                            ) : (
                                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                                    {renderMarkdown(String(value))}
                                </p>
                            )}
                        </div>
                    )
                })}
            </CardContent>
        </Card>
    )
}
