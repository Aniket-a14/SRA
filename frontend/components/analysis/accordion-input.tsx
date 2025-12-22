"use client"

import { useState } from "react"
import { SRS_STRUCTURE } from "@/lib/srs-structure"
import { SRSIntakeModel, SystemFeatureItem } from "@/types/srs-intake"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Trash2, Sparkles, ChevronDown, ChevronUp } from "lucide-react"

interface AccordionInputProps {
    data: SRSIntakeModel;
    onUpdate: (section: string, field: string, value: string) => void;
    onFeatureUpdate: (featureId: string, field: string, value: string) => void;
    onAddFeature: () => void;
    onRemoveFeature: (featureId: string) => void;
    onFeatureExpand: (featureId: string) => void;
    onValidate: () => void;
    isValidating: boolean;
}

export function AccordionInput({
    data,
    onUpdate,
    onFeatureUpdate,
    onAddFeature,
    onRemoveFeature,
    onFeatureExpand,
    onValidate,
    isValidating
}: AccordionInputProps) {
    const [openItem, setOpenItem] = useState("item-0")
    const [expandedStructured, setExpandedStructured] = useState<Record<string, boolean>>({})

    const toggleStructured = (id: string) => {
        setExpandedStructured(prev => ({ ...prev, [id]: !prev[id] }))
    }

    return (
        <div className="w-full max-w-4xl mx-auto space-y-6 pb-20">
            <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Structured Requirements Input</h2>
                <p className="text-muted-foreground">Complete each section to proceed to validation.</p>
            </div>

            <Accordion type="single" collapsible value={openItem} onValueChange={setOpenItem} className="w-full border rounded-lg bg-card">
                {SRS_STRUCTURE.map((section, idx) => {
                    const sectionData = data[section.key as keyof SRSIntakeModel];
                    const isComplete = section.subsections.every(sub => {
                        if (sub.inputType === 'textarea') {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const val = (sectionData as any)?.[sub.key]?.content || "";
                            return !sub.isRequired || val.trim().length > 0;
                        } else {
                            // For features, we require at least one feature if it's required (for now assuming true)
                            // And each feature must have description and functional requirements
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const features = (sectionData && 'features' in sectionData) ? (sectionData as any).features : [];
                            if (sub.isRequired && features.length === 0) return false;
                            return (features as SystemFeatureItem[]).every((f: SystemFeatureItem) =>
                                f.name.trim() &&
                                f.description?.content?.trim() &&
                                f.functionalRequirements?.content?.trim()
                            );
                        }
                    });

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
                                {section.subsections.map(sub => {
                                    if (sub.inputType === 'textarea') {
                                        return (
                                            <div key={sub.id} className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-sm font-medium leading-none">
                                                        {sub.id} {sub.title}
                                                        {sub.isRequired && <span className="text-destructive ml-1">*</span>}
                                                    </label>
                                                </div>
                                                {sub.description && (
                                                    <p className="text-xs text-muted-foreground">{sub.description}</p>
                                                )}

                                                <Textarea
                                                    placeholder={sub.placeholder || "Enter details..."}
                                                    className="min-h-[120px] resize-none"
                                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                    value={(sectionData as any)?.[sub.key]?.content || ""}
                                                    onChange={(e) => onUpdate(section.key, sub.key, e.target.value)}
                                                />

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
                                        );
                                    }

                                    // Dynamic List Implementation (Features)
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    const features = (sectionData && 'features' in sectionData) ? (sectionData as any).features : [];
                                    return (
                                        <div key={sub.id} className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <label className="text-sm font-medium leading-none">
                                                    {sub.id} {sub.title}
                                                    {sub.isRequired && <span className="text-destructive ml-1">*</span>}
                                                </label>
                                                <Button size="sm" variant="outline" onClick={onAddFeature}>
                                                    Add Feature
                                                </Button>
                                            </div>
                                            {sub.description && (
                                                <p className="text-xs text-muted-foreground">{sub.description}</p>
                                            )}

                                            {features.length === 0 ? (
                                                <div className="p-8 border border-dashed rounded bg-muted/20 text-center">
                                                    <p className="text-sm text-muted-foreground">No features defined yet. Add features to specify functional requirements.</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {features.map((feature: SystemFeatureItem) => (
                                                        <div key={feature.id} className="p-4 border rounded-md bg-muted/10 space-y-4 relative group">
                                                            <div className="flex items-center justify-between gap-4 mr-8">
                                                                <div className="flex-1 space-y-2">
                                                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Feature Name</label>
                                                                    <input
                                                                        className="w-full bg-transparent border-b border-muted-foreground/20 focus:border-primary outline-none py-1 font-semibold"
                                                                        placeholder="e.g. Real-time Search"
                                                                        value={feature.name}
                                                                        onChange={(e) => onFeatureUpdate(feature.id, 'name', e.target.value)}
                                                                    />
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                                                                    onClick={() => onRemoveFeature(feature.id)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>

                                                            <div className="space-y-2">
                                                                <div className="flex items-center justify-between">
                                                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Feature Description (Plain Text)</label>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        className="h-7 text-[10px] gap-1 text-primary hover:text-primary hover:bg-primary/10"
                                                                        onClick={() => onFeatureExpand(feature.id)}
                                                                    >
                                                                        <Sparkles className="h-3 w-3" />
                                                                        Auto-Generate IEEE Details
                                                                    </Button>
                                                                </div>
                                                                <Textarea
                                                                    placeholder="Describe what this feature does in simple terms..."
                                                                    className="min-h-[60px] bg-background border-dashed"
                                                                    value={feature.rawInput || ""}
                                                                    onChange={(e) => onFeatureUpdate(feature.id, 'rawInput', e.target.value)}
                                                                />
                                                            </div>

                                                            {/* Collapsible Structured Details */}
                                                            <div className="pt-2 border-t border-muted-foreground/5">
                                                                <button
                                                                    onClick={() => toggleStructured(feature.id)}
                                                                    className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                                                                >
                                                                    {expandedStructured[feature.id] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                                                    Structured IEEE Details {(!feature.description?.content) && "(Empty)"}
                                                                </button>

                                                                {expandedStructured[feature.id] && (
                                                                    <div className="mt-4 space-y-4 pb-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                                        <div className="space-y-2">
                                                                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Structured Description</label>
                                                                            <Textarea
                                                                                className="min-h-[80px] bg-background text-sm"
                                                                                value={feature.description?.content || ""}
                                                                                onChange={(e) => onFeatureUpdate(feature.id, 'description', e.target.value)}
                                                                            />
                                                                        </div>

                                                                        <div className="space-y-2">
                                                                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Stimulus/Response Sequences</label>
                                                                            <Textarea
                                                                                className="min-h-[80px] bg-background text-sm"
                                                                                value={feature.stimulusResponse?.content || ""}
                                                                                onChange={(e) => onFeatureUpdate(feature.id, 'stimulusResponse', e.target.value)}
                                                                            />
                                                                        </div>

                                                                        <div className="space-y-2">
                                                                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Functional Requirements</label>
                                                                            <Textarea
                                                                                className="min-h-[100px] bg-background text-sm"
                                                                                value={feature.functionalRequirements?.content || ""}
                                                                                onChange={(e) => onFeatureUpdate(feature.id, 'functionalRequirements', e.target.value)}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

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
