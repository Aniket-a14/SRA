"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SRSIntakeModel, IntakeField, SystemFeatureItem, DomainType, ValidationResult } from '../types/srs-intake';
import { SRS_STRUCTURE, createInitialIntakeState } from './srs-structure';
import { toast } from 'sonner';

interface IntakeContextType {
    data: SRSIntakeModel;
    activeSectionId: string;
    activeSectionIndex: number;
    updateField: (sectionKey: keyof SRSIntakeModel, fieldKey: string, value: string) => void;
    updateFeature: (featureId: string, field: keyof SystemFeatureItem, value: string | DomainType, isDomain?: boolean) => void;
    addFeature: () => void;
    removeFeature: (featureId: string) => void;
    updateDomainType: (sectionKey: keyof SRSIntakeModel, fieldKey: string, domain: DomainType) => void;
    setActiveSection: (sectionId: string) => void;
    nextSection: () => void;
    prevSection: () => void;
    canProceed: boolean;
    saveDraft: () => void;
    validateRequirements: () => Promise<void>;
    validationResult: ValidationResult | null;
    isValidating: boolean;
    clearValidation: () => void;
    expandFeature: (id: string) => Promise<void>;
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
                // In a real app, we'd validate the schema version
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const section = prev[sectionKey] as any;
            const field = section[fieldKey] as IntakeField;

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

    const updateDomainType = (sectionKey: keyof SRSIntakeModel, fieldKey: string, domain: DomainType) => {
        setData(prev => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const section = prev[sectionKey] as any;
            const field = section[fieldKey] as IntakeField;
            return {
                ...prev,
                [sectionKey]: {
                    ...section,
                    [fieldKey]: {
                        ...field,
                        metadata: {
                            ...field.metadata,
                            domain_type: domain
                        }
                    }
                }
            }
        });
    }

    // System Features Special Handling
    const addFeature = () => {
        setData(prev => {
            const newFeature: SystemFeatureItem = {
                id: crypto.randomUUID(),
                name: 'New Feature',
                rawInput: '',
                description: { content: '', metadata: { section_id: '4', subsection_id: '4.1.1', domain_type: 'web', is_required: true, completion_status: 'empty' } },
                stimulusResponse: { content: '', metadata: { section_id: '4', subsection_id: '4.1.2', domain_type: 'web', is_required: true, completion_status: 'empty' } },
                functionalRequirements: { content: '', metadata: { section_id: '4', subsection_id: '4.1.3', domain_type: 'web', is_required: true, completion_status: 'empty' } }
            };
            return {
                ...prev,
                systemFeatures: {
                    features: [...prev.systemFeatures.features, newFeature]
                }
            };
        });
    };

    const removeFeature = (id: string) => {
        setData(prev => ({
            ...prev,
            systemFeatures: {
                features: prev.systemFeatures.features.filter(f => f.id !== id)
            }
        }));
    };

    const updateFeature = (id: string, field: keyof SystemFeatureItem, value: string | DomainType, isDomain: boolean = false) => {
        setData(prev => ({
            ...prev,
            systemFeatures: {
                features: prev.systemFeatures.features.map(f => {
                    if (f.id !== id) return f;
                    if (field === 'name') return { ...f, name: value as string };
                    if (field === 'rawInput') return { ...f, rawInput: value as string };

                    // It's an IntakeField
                    const intakeField = f[field] as IntakeField;

                    if (isDomain) {
                        return {
                            ...f,
                            [field]: {
                                ...intakeField,
                                metadata: { ...intakeField.metadata, domain_type: value as DomainType }
                            }
                        }
                    }

                    const content = value as string;
                    const status = content.trim().length > 0 ? 'complete' : 'empty';

                    return {
                        ...f,
                        [field]: {
                            ...intakeField,
                            content,
                            metadata: { ...intakeField.metadata, completion_status: status }
                        }
                    }
                })
            }
        }))
    }

    const expandFeature = async (id: string) => {
        const feature = data.systemFeatures.features.find(f => f.id === id);
        if (!feature || !feature.name || !feature.rawInput) {
            toast.error("Please provide both a feature name and a description first.");
            return;
        }

        const loadingToast = toast.loading(`Expanding "${feature.name}"...`);
        try {
            // Note: Since this is intake flow (before login/project creation), 
            // the backend route might need some special handling if it's protected.
            // But usually this intake is run by logged-in users? 
            // Let me check if I have a token.
            const token = localStorage.getItem('sra_auth_token');

            const response = await fetch(`${API_URL}/api/analyze/expand-feature`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    name: feature.name,
                    prompt: feature.rawInput
                })
            });

            if (!response.ok) throw new Error("Expansion failed");
            const expanded = await response.json();

            setData(prev => ({
                ...prev,
                systemFeatures: {
                    features: prev.systemFeatures.features.map(f => {
                        if (f.id !== id) return f;
                        return {
                            ...f,
                            description: {
                                ...f.description,
                                content: expanded.description,
                                metadata: { ...f.description.metadata, completion_status: 'complete' }
                            },
                            stimulusResponse: {
                                ...f.stimulusResponse,
                                content: (expanded.stimulusResponseSequences || []).join('\n'),
                                metadata: { ...f.stimulusResponse.metadata, completion_status: 'complete' }
                            },
                            functionalRequirements: {
                                ...f.functionalRequirements,
                                content: (expanded.functionalRequirements || []).join('\n'),
                                metadata: { ...f.functionalRequirements.metadata, completion_status: 'complete' }
                            }
                        };
                    })
                }
            }));

            toast.success("Feature expanded!", { id: loadingToast });
        } catch (error) {
            console.error(error);
            toast.error("Expansion failed", { id: loadingToast });
        }
    };

    // Validation Logic
    const checkCanProceed = () => {
        if (!activeSectionConfig) return false;

        // Special check for Features (Section 4)
        if (activeSectionConfig.key === 'systemFeatures') {
            // Must have at least one feature? Maybe not enforced, but let's say yes for now or just check content of existing
            // If features exist, they must be valid
            if (data.systemFeatures.features.length === 0) return true; // Or false if we require at least 1
            return data.systemFeatures.features.every(f =>
                f.description.content.trim() && f.functionalRequirements.content.trim()
            );
        }

        // Standard Sections
        return activeSectionConfig.subsections.every(sub => {
            if (!sub.isRequired) return true;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const field = (data[activeSectionConfig.key] as any)[sub.key] as IntakeField;
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
        // Optional: Block jumping forward if previous sections invalid?
        // For now allowing navigation but 'Completion' status implies validity
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
            updateFeature,
            addFeature,
            removeFeature,
            updateDomainType,
            setActiveSection,
            nextSection,
            prevSection,
            canProceed,
            saveDraft,
            validateRequirements,
            validationResult,
            isValidating,
            clearValidation,
            expandFeature
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
