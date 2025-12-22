"use client";

import React, { useState } from 'react';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Info, AlertCircle, CheckCircle } from 'lucide-react';
import { SubsectionConfig } from '@/lib/srs-structure';
import { IntakeField } from '@/types/srs-intake';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface SubsectionInputProps {
    config: SubsectionConfig;
    field: IntakeField;
    onChange: (value: string) => void;
    onDomainChange?: (domain: string) => void;
}

export function SubsectionInput({ config, field, onChange, onDomainChange }: SubsectionInputProps) {
    const [showHints, setShowHints] = useState(false);
    const isEmpty = field.content.trim().length === 0;
    const isError = config.isRequired && isEmpty;

    return (
        <div className="space-y-3 mb-8 border-l-2 border-border pl-6 relative">
            {/* Status Indicator Line */}
            <div className={`absolute -left-[2px] top-0 bottom-0 w-[2px] transition-colors ${!isEmpty ? 'bg-green-500' : isError ? 'bg-red-400' : 'bg-muted'
                }`} />

            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-muted-foreground">{config.id}</span>
                        <Label className={`text-lg font-semibold ${isError ? 'text-red-500' : ''}`}>
                            {config.title}
                        </Label>
                        {config.isRequired ? (
                            <Badge variant="secondary" className="text-xs">Required</Badge>
                        ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">Optional</Badge>
                        )}
                        {!isEmpty && (
                            <CheckCircle className="w-4 h-4 text-green-500 ml-2" />
                        )}
                    </div>
                    {config.description && (
                        <p className="text-sm text-muted-foreground max-w-2xl">
                            {config.description}
                        </p>
                    )}
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHints(!showHints)}
                    className={showHints ? 'bg-accent' : ''}
                >
                    <Info className="w-4 h-4 mr-2" />
                    {showHints ? 'Hide Hints' : 'Hints'}
                </Button>
            </div>

            {showHints && (
                <div className="bg-accent/50 p-4 rounded-md text-sm space-y-2 animate-in fade-in slide-in-from-top-1">
                    <p className="font-semibold text-accent-foreground">Suggestions:</p>
                    <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                        {config.hints.map((hint, i) => (
                            <li key={i}>{hint}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="space-y-2">
                <Textarea
                    value={field.content}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={config.placeholder}
                    className={`min-h-[120px] resize-y ${isError ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                />

                {onDomainChange && (
                    <div className="flex items-center justify-end gap-2 mt-2">
                        <Label className="text-xs text-muted-foreground">Domain Context:</Label>
                        <Select value={field.metadata.domain_type} onValueChange={onDomainChange}>
                            <SelectTrigger className="w-[120px] h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="web">Web</SelectItem>
                                <SelectItem value="mobile">Mobile</SelectItem>
                                <SelectItem value="system">System</SelectItem>
                                <SelectItem value="hybrid">Hybrid</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            {isError && (
                <div className="flex items-center gap-2 text-red-500 text-xs animate-in slide-in-from-left-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>This section is required before proceeding.</span>
                </div>
            )}
        </div>
    );
}
