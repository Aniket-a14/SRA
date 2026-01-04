"use client";

import React from 'react';
import { useIntake } from '@/lib/intake-context';
import { SRS_STRUCTURE } from '@/lib/srs-structure';
import { SubsectionInput } from './SubsectionInput';

export function SectionRenderer() {
    const {
        data,
        activeSectionIndex,
        updateField,
        updateDomainType,
    } = useIntake();

    const config = SRS_STRUCTURE[activeSectionIndex];

    if (!config) return <div>Section not found</div>;

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
                        field={(data[config.key] as any)?.[sub.key]}
                        onChange={(val) => updateField(config.key, sub.key, val)}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        onDomainChange={(d) => updateDomainType(config.key, sub.key, d as any)}
                    />
                ))}
            </div>
        </div>
    );
}
