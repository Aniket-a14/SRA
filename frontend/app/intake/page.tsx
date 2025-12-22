"use client";

import React from 'react';
import { IntakeProvider } from '@/lib/intake-context';
import { IntakeLayout } from '@/components/intake/IntakeLayout';
import { SectionRenderer } from '@/components/intake/SectionRenderer';

export default function SRSIntakePage() {
    return (
        <IntakeProvider>
            <IntakeLayout>
                <SectionRenderer />
            </IntakeLayout>
        </IntakeProvider>
    );
}
