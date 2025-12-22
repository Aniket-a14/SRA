"use client";

import React from 'react';
import { useIntake } from '@/lib/intake-context';
import { SRS_STRUCTURE, SubsectionConfig } from '@/lib/srs-structure';
import { SubsectionInput } from './SubsectionInput';
import { Button } from '../ui/button';
import { Plus, Trash2, Box } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Separator } from '../ui/separator';

export function SectionRenderer() {
    const {
        data,
        activeSectionIndex,
        updateField,
        updateDomainType,
        addFeature,
        removeFeature,
        updateFeature
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
                        {features.map((feature, index) => (
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
                                    <SubsectionInput
                                        config={{ ...config.subsections[0], id: `4.${index + 1}.1`, title: 'Description & Priority', description: 'Detailed description of the feature and its priority.' } as SubsectionConfig}
                                        field={feature.description}
                                        onChange={(val) => updateFeature(feature.id, 'description', val)}
                                        onDomainChange={(d) => updateFeature(feature.id, 'description', d)} // Hacky reuse, but domain update logic needs to handle feature fields specially if we want granular domain per field. Currently context supports it.
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
                                </CardContent>
                            </Card>
                        ))}
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
