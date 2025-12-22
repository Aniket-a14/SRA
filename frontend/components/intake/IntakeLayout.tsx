"use client";

import React from 'react';
import { useIntake } from '@/lib/intake-context';
import { SRS_STRUCTURE } from '@/lib/srs-structure';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { Check, ChevronRight, ChevronLeft, Save, FileText } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

import { ValidationReport } from './ValidationReport';
import { Loader2 } from 'lucide-react';

export function IntakeLayout({ children }: { children: React.ReactNode }) {
    const {
        activeSectionId,
        setActiveSection,
        nextSection,
        prevSection,
        canProceed,
        saveDraft,
        activeSectionIndex,
        validateRequirements,
        isValidating
    } = useIntake();

    const isLastSection = activeSectionIndex === SRS_STRUCTURE.length - 1;

    return (
        <div className="flex h-screen bg-background overflow-hidden">
            <ValidationReport />

            {/* Sidebar Stepper */}
            <aside className="w-80 border-r bg-muted/10 hidden md:flex flex-col">
                <div className="p-6 border-b">
                    <div className="flex items-center gap-2 font-bold text-xl text-primary">
                        <FileText className="w-6 h-6" />
                        <span>SRS Builder</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Section-based intake system</p>
                </div>

                <ScrollArea className="flex-1 py-6 px-4">
                    <div className="space-y-1">
                        {SRS_STRUCTURE.map((section, idx) => {
                            const isActive = section.id === activeSectionId;
                            const isPast = idx < activeSectionIndex;

                            return (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id)}
                                    // Disable future jumping if strictly enforced, but usually better to verify on 'Next'
                                    className={cn(
                                        "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md transition-all",
                                        isActive
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "hover:bg-muted text-muted-foreground",
                                        isPast && !isActive && "text-foreground"
                                    )}
                                >
                                    <div className={cn(
                                        "w-6 h-6 rounded-full flex items-center justify-center text-xs border transition-colors",
                                        isActive ? "border-primary-foreground/30 bg-primary-foreground/20" :
                                            isPast ? "bg-green-500 border-green-500 text-white" : "border-muted-foreground/30"
                                    )}>
                                        {isPast ? <Check className="w-3 h-3" /> : section.id}
                                    </div>
                                    <span className="text-left truncate">{section.title}</span>
                                </button>
                            )
                        })}
                    </div>
                </ScrollArea>

                <div className="p-4 border-t bg-background/50 backdrop-blur-sm">
                    <Button variant="outline" className="w-full" onClick={saveDraft}>
                        <Save className="w-4 h-4 mr-2" />
                        Save Draft
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0">
                <header className="h-16 border-b flex items-center justify-between px-8 bg-background sticky top-0 z-10">
                    <div className="md:hidden font-semibold">SRS Builder</div> {/* Mobile header placeholder */}
                    <div className="flex-1" /> {/* Spacer */}
                    <div className="text-sm text-muted-foreground">
                        Step {activeSectionIndex + 1} of {SRS_STRUCTURE.length}
                    </div>
                </header>

                <ScrollArea className="flex-1">
                    <div className="max-w-5xl mx-auto p-8 md:p-12">
                        {children}
                    </div>
                </ScrollArea>

                {/* Footer Navigation */}
                <footer className="border-t p-6 bg-background flex items-center justify-between max-w-full z-10">
                    <Button
                        variant="ghost"
                        onClick={prevSection}
                        disabled={activeSectionIndex === 0 || isValidating}
                    >
                        <ChevronLeft className="w-4 h-4 mr-2" />
                        Previous
                    </Button>

                    <div className="flex gap-4">
                        {isLastSection ? (
                            <Button
                                size="lg"
                                className="bg-green-600 hover:bg-green-700 w-40"
                                onClick={validateRequirements}
                                disabled={!canProceed || isValidating}
                            >
                                {isValidating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Validating...
                                    </>
                                ) : (
                                    <>
                                        Finish <Check className="w-4 h-4 ml-2" />
                                    </>
                                )}
                            </Button>
                        ) : (
                            <Button size="lg" onClick={nextSection} disabled={!canProceed || isValidating} className="w-32">
                                Next <ChevronRight className="w-4 h-4 ml-2" />
                            </Button>
                        )}
                    </div>
                </footer>
            </main>
        </div>
    );
}
