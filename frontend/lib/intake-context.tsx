"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SRSIntakeModel, IntakeField, ValidationResult } from '../types/srs-intake';
import { SRS_STRUCTURE, createInitialIntakeState } from './srs-structure';
// Removed: import { toast } from 'sonner';

interface IntakeContextType {
    data: SRSIntakeModel;
    activeSectionId: string;
    activeSectionIndex: number;
    updateField: (sectionKey: keyof SRSIntakeModel, fieldKey: string, value: string) => void;
    setActiveSection: (sectionId: string) => void;
    nextSection: () => void;
    prevSection: () => void;
    canProceed: boolean;
    saveDraft: () => void;
    validateRequirements: () => Promise<void>;
    validationResult: ValidationResult | null;
    isValidating: boolean;
    clearValidation: () => void;
}

// Helper for backend URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const IntakeContext = createContext<IntakeContextType | undefined>(undefined);

export const IntakeProvider = ({ children }: { children: ReactNode }) => {
    // Try to load from localStorage first (client-side only pattern)
    const [data, setData] = useState<SRSIntakeModel>(createInitialIntakeState());
    const [activeSectionId, setActiveSectionIdState] = useState<string>('1');
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const savedData = localStorage.getItem('sra_intake_draft');
        if (savedData) {
            try {
                // Deep merge or specific parsing could be safer, but for now strict parse
                const parsed = JSON.parse(savedData);
                setData(parsed);
            } catch (e) {
                console.error("Failed to load draft", e);
            }
        }
        setIsLoaded(true);
    }, []);

    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem('sra_intake_draft', JSON.stringify(data));
        }
    }, [data, isLoaded]);

    const activeSectionIndex = SRS_STRUCTURE.findIndex(s => s.id === activeSectionId);
    const activeSectionConfig = SRS_STRUCTURE[activeSectionIndex];

    const updateField = (sectionKey: keyof SRSIntakeModel, fieldKey: string, value: string) => {
        setData(prev => {
            const section = prev[sectionKey];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const field = (section as any)[fieldKey] as IntakeField;

            // Determine status
            const status = value.trim().length > 0 ? 'complete' : 'empty';

            return {
                ...prev,
                [sectionKey]: {
                    ...section,
                    [fieldKey]: {
                        ...field,
                        content: value,
                        metadata: {
                            ...field.metadata,
                            completion_status: status
                        }
                    }
                }
            };
        });
    };

    // Validation Logic
    const checkCanProceed = () => {
        if (!activeSectionConfig) return false;

        // Standard Sections
        return activeSectionConfig.subsections.every(sub => {
            if (!sub.isRequired) return true;
            const section = data[activeSectionConfig.key as keyof SRSIntakeModel];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const field = (section as any)[sub.key] as IntakeField;
            return field && field.content && field.content.trim().length > 0;
        });
    };

    const canProceed = checkCanProceed();

    const nextSection = () => {
        if (!canProceed) return;
        if (activeSectionIndex < SRS_STRUCTURE.length - 1) {
            setActiveSectionIdState(SRS_STRUCTURE[activeSectionIndex + 1].id);
            window.scrollTo(0, 0);
        }
    };

    const prevSection = () => {
        if (activeSectionIndex > 0) {
            setActiveSectionIdState(SRS_STRUCTURE[activeSectionIndex - 1].id);
            window.scrollTo(0, 0);
        }
    };

    const setActiveSection = (id: string) => {
        setActiveSectionIdState(id);
    }

    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
    const [isValidating, setIsValidating] = useState(false);

    const validateRequirements = async () => {
        setIsValidating(true);
        // Clear previous result
        setValidationResult(null);

        try {
            const response = await fetch(`${API_URL}/api/validation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || 'Validation request failed');
            }

            const result: ValidationResult = await response.json();
            setValidationResult(result);
        } catch (error) {
            console.error("Validation Error:", error);
            // On error, show a generic failure result or alert
            alert("Validation failed to complete. Please try again.");
        } finally {
            setIsValidating(false);
        }
    };

    const clearValidation = () => setValidationResult(null);

    const saveDraft = () => {
        localStorage.setItem('sra_intake_draft', JSON.stringify(data));
        alert('Draft saved locally!');
    };

    return (
        <IntakeContext.Provider value={{
            data,
            activeSectionId,
            activeSectionIndex,
            updateField,
            setActiveSection,
            nextSection,
            prevSection,
            canProceed,
            saveDraft,
            validateRequirements,
            validationResult,
            isValidating,
            clearValidation
        }}>
            {children}
        </IntakeContext.Provider>
    );
};

export const useIntake = () => {
    const context = useContext(IntakeContext);
    if (!context) throw new Error('useIntake must be used within IntakeProvider');
    return context;
};
