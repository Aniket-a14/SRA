"use client"

import { useState } from "react"
import { SRS_STRUCTURE } from "@/lib/srs-structure"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2 } from "lucide-react"

interface AccordionInputProps {
    data: Record<string, unknown>;
    onUpdate: (section: string, field: string, value: string) => void;
    onValidate: () => void;
    isValidating: boolean;
}

export function AccordionInput({ data, onUpdate, onValidate, isValidating }: AccordionInputProps) {
    const [openItem, setOpenItem] = useState("item-0")

    // Helper to calculate progress is TBD

    return (
        <div className="w-full max-w-4xl mx-auto space-y-6 pb-20">
            <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Structured Requirements Input</h2>
                <p className="text-muted-foreground">Complete each section to proceed to validation.</p>
            </div>

            <Accordion type="single" collapsible value={openItem} onValueChange={setOpenItem} className="w-full border rounded-lg bg-card">
                {SRS_STRUCTURE.map((section, idx) => {
                    const sectionData = (data[section.key] as Record<string, { content: string }>) || {};
                    const isComplete = false; // TODO: Real check

                    return (
                        <AccordionItem key={section.id} value={`item-${idx}`}>
                            <AccordionTrigger className="px-6 hover:no-underline hover:bg-muted/50">
                                <div className="flex items-center gap-3 w-full">
                                    <div className="flex items-center justify-center w-6 h-6 rounded-full border text-xs font-medium">
                                        {section.id}
                                    </div>
                                    <span className="font-semibold">{section.title}</span>
                                    {isComplete ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto mr-4" />
                                    ) : (
                                        <div className="ml-auto mr-4" />
                                    )}
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-6 py-4 space-y-6">
                                {section.subsections.map(sub => (
                                    <div key={sub.id} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                                {sub.id} {sub.title}
                                                {sub.isRequired && <span className="text-destructive ml-1">*</span>}
                                            </label>
                                        </div>
                                        {sub.description && (
                                            <p className="text-xs text-muted-foreground">{sub.description}</p>
                                        )}

                                        {sub.inputType === 'textarea' ? (
                                            <Textarea
                                                placeholder={sub.placeholder || "Enter details..."}
                                                className="min-h-[120px] resize-none"
                                                value={sectionData[sub.key]?.content || ""}
                                                onChange={(e) => onUpdate(section.key, sub.key, e.target.value)}
                                            />
                                        ) : (
                                            <div className="p-4 border border-dashed rounded bg-muted/20 text-center text-sm text-muted-foreground">
                                                Dynamic Lists (e.g. Features) Custom UI TBD
                                            </div>
                                        )}

                                        {sub.hints && sub.hints.length > 0 && (
                                            <div className="flex flex-wrap gap-2 pt-1">
                                                {sub.hints.map((hint, i) => (
                                                    <Badge key={i} variant="outline" className="text-[10px] text-muted-foreground font-normal">
                                                        {hint}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                <div className="flex justify-end pt-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setOpenItem(`item-${idx + 1}`)}
                                        disabled={idx === SRS_STRUCTURE.length - 1}
                                    >
                                        Next Section
                                    </Button>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    )
                })}
            </Accordion>

            <div className="flex justify-end items-center gap-4 fixed bottom-0 left-0 right-0 p-4 bg-background border-t z-10 md:pl-64">
                <div className="text-sm text-muted-foreground">
                    Layer 1: Input Phase
                </div>
                <Button onClick={onValidate} disabled={isValidating} size="lg">
                    {isValidating ? "Validating..." : "Run Validation Check (Layer 2)"}
                </Button>
            </div>
        </div>
    )
}
