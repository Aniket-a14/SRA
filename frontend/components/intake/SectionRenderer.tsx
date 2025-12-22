"use client";

import React from 'react';
import { useIntake } from '@/lib/intake-context';
import { SRS_STRUCTURE, SubsectionConfig } from '@/lib/srs-structure';
import { SubsectionInput } from './SubsectionInput';
import { Button } from '../ui/button';
import { Plus, Trash2, Box, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Separator } from '../ui/separator';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';

export function SectionRenderer() {
    const {
        data,
        activeSectionIndex,
        updateField,
        updateDomainType,
        addFeature,
        removeFeature,
        updateFeature,
        expandFeature
    } = useIntake();

    const config = SRS_STRUCTURE[activeSectionIndex];

    if (!config) return <div>Section not found</div>;

    // Special Handling for System Features (Dynamic List)
    if (config.key === 'systemFeatures') {
        const features = data.systemFeatures.features;

        return (
            <div className="space-y-8 animate-in fade-in">
                <div className="flex items-center justify-between pb-4 border-b">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">{config.title}</h2>
                        <p className="text-muted-foreground mt-2">
                            {config.subsections[0].description}
                        </p>
                    </div>
                    <Button onClick={addFeature}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Feature
                    </Button>
                </div>

                {features.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                        <Box className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">No features added yet</p>
                        <p className="text-sm mb-4">Add your first system feature to define functional requirements.</p>
                        <Button variant="secondary" onClick={addFeature}>Add Feature</Button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {features.map((feature, index) => {
                            const [isExpanded, setIsExpanded] = React.useState(false);

                            return (
                                <Card key={feature.id} className="relative group overflow-hidden border-l-4 border-l-primary">
                                    <CardHeader className="bg-muted/20 pb-4">
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1 flex-1">
                                                <div className="flex items-center gap-3">
                                                    <span className="bg-primary text-primary-foreground text-xs font-mono px-2 py-1 rounded">
                                                        4.{index + 1}
                                                    </span>
                                                    <input
                                                        className="bg-transparent text-xl font-bold border-none focus:outline-none focus:ring-0 w-full"
                                                        value={feature.name}
                                                        onChange={(e) => updateFeature(feature.id, 'name', e.target.value)}
                                                        placeholder="Feature Name (e.g., Login System)"
                                                    />
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                                                onClick={() => removeFeature(feature.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-6 space-y-6">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-sm font-semibold tracking-tight">Feature Description (Plain Text)</label>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="h-8 gap-2 bg-primary/5 text-primary hover:bg-primary/10 border-primary/20"
                                                    onClick={() => expandFeature(feature.id)}
                                                >
                                                    <Sparkles className="h-4 w-4" />
                                                    Auto-Generate IEEE Details
                                                </Button>
                                            </div>
                                            <Textarea
                                                placeholder="What should this feature do? (e.g. Customers can browse books by category and author, add to cart, and checkout with Stripe.)"
                                                className="min-h-[100px] bg-background border-dashed resize-none"
                                                value={feature.rawInput || ""}
                                                onChange={(e) => updateFeature(feature.id, 'rawInput', e.target.value)}
                                            />
                                            <p className="text-[10px] text-muted-foreground italic">
                                                Tip: A short description here helps the AI generate precise technical requirements.
                                            </p>
                                        </div>

                                        <Separator />

                                        <div className="space-y-4">
                                            <button
                                                onClick={() => setIsExpanded(!isExpanded)}
                                                className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                                            >
                                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                Structured IEEE Details {(!feature.description?.content) && "(Empty)"}
                                            </button>

                                            {isExpanded && (
                                                <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                                                    <SubsectionInput
                                                        config={{ ...config.subsections[0], id: `4.${index + 1}.1`, title: 'Description & Priority', description: 'Detailed description of the feature and its priority.' } as SubsectionConfig}
                                                        field={feature.description}
                                                        onChange={(val) => updateFeature(feature.id, 'description', val)}
                                                        onDomainChange={(d) => updateFeature(feature.id, 'description', d, true)}
                                                    />
                                                    <Separator />
                                                    <SubsectionInput
                                                        config={{ ...config.subsections[0], id: `4.${index + 1}.2`, title: 'Stimulus/Response Sequences', description: 'Trigger events and expected system responses.' } as SubsectionConfig}
                                                        field={feature.stimulusResponse}
                                                        onChange={(val) => updateFeature(feature.id, 'stimulusResponse', val)}
                                                    />
                                                    <Separator />
                                                    <SubsectionInput
                                                        config={{ ...config.subsections[0], id: `4.${index + 1}.3`, title: 'Functional Requirements', description: 'Specific functional checks and behaviors.' } as SubsectionConfig}
                                                        field={feature.functionalRequirements}
                                                        onChange={(val) => updateFeature(feature.id, 'functionalRequirements', val)}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        )
    }

    // Standard Render
    return (
        <div className="space-y-8 animate-in fade-in max-w-4xl mx-auto">
            <div className="pb-6 border-b">
                <div className="flex items-center gap-3 mb-2">
                    <span className="text-4xl font-bold text-muted-foreground/30 select-none">
                        {config.id}
                    </span>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">
                        {config.title}
                    </h1>
                </div>
                <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
                    Enter the details for {config.title.toLowerCase()} below. Use the hints if you need guidance on what to include.
                </p>
            </div>

            <div className="space-y-12">
                {config.subsections.map(sub => (
                    <SubsectionInput
                        key={sub.id}
                        config={sub}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        field={(data[config.key] as any)[sub.key]}
                        onChange={(val) => updateField(config.key, sub.key, val)}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        onDomainChange={(d) => updateDomainType(config.key, sub.key, d as any)}
                    />
                ))}
            </div>
        </div>
    );
}
