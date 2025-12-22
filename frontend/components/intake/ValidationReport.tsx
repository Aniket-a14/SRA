"use client";

import React from 'react';
import { useIntake } from '@/lib/intake-context';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { CheckCircle, XCircle, AlertTriangle, ArrowRight, X } from 'lucide-react';
import { ValidationIssue } from '@/types/srs-intake';
import { Badge } from '../ui/badge';

export function ValidationReport() {
    const { validationResult, clearValidation, setActiveSection } = useIntake();

    if (!validationResult) return null;

    const isPass = validationResult.validation_status === 'PASS';
    const blockers = validationResult.issues.filter(i => i.severity === 'BLOCKER');
    const warnings = validationResult.issues.filter(i => i.severity === 'WARNING');

    const handleJumpToIssue = (issue: ValidationIssue) => {
        // Close modal
        clearValidation();
        // Jump to section
        setActiveSection(issue.section_id);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <Card className="w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                <CardHeader className={`border-b ${isPass ? 'bg-green-50' : 'bg-red-50'}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {isPass ? (
                                <CheckCircle className="w-8 h-8 text-green-600" />
                            ) : (
                                <XCircle className="w-8 h-8 text-red-600" />
                            )}
                            <div>
                                <CardTitle className="text-2xl">
                                    Validation {isPass ? 'Successful' : 'Failed'}
                                </CardTitle>
                                <p className="text-muted-foreground">
                                    {isPass
                                        ? "Your SRS draft meets the initial requirements. You may proceed."
                                        : "Please resolve the blocking issues below to proceed."}
                                </p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={clearValidation}>
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </CardHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Blockers */}
                    {blockers.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="font-semibold text-red-600 flex items-center gap-2">
                                <XCircle className="w-4 h-4" /> Blocking Issues ({blockers.length})
                            </h3>
                            {blockers.map((issue, idx) => (
                                <Card key={idx} className="border-l-4 border-l-red-500 bg-red-50/50">
                                    <CardContent className="pt-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Badge variant="destructive">{issue.issue_type}</Badge>
                                                    <span className="font-mono text-xs text-muted-foreground">
                                                        Section {issue.subsection_id || issue.section_id}
                                                    </span>
                                                </div>
                                                <p className="font-medium text-red-900">{issue.title}</p>
                                                <p className="text-sm text-red-700 mt-1">{issue.description}</p>
                                                {issue.suggested_fix && (
                                                    <div className="mt-2 text-sm bg-white p-2 rounded border border-red-100">
                                                        <span className="font-semibold text-red-800">Suggestion: </span>
                                                        {issue.suggested_fix}
                                                    </div>
                                                )}
                                            </div>
                                            <Button size="sm" variant="outline" onClick={() => handleJumpToIssue(issue)}>
                                                Fix
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* Warnings */}
                    {warnings.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="font-semibold text-amber-600 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" /> Warnings ({warnings.length})
                            </h3>
                            {warnings.map((issue, idx) => (
                                <Card key={idx} className="border-l-4 border-l-amber-500 bg-amber-50/50">
                                    <CardContent className="pt-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-200">{issue.issue_type}</Badge>
                                                    <span className="font-mono text-xs text-muted-foreground">
                                                        Section {issue.subsection_id || issue.section_id}
                                                    </span>
                                                </div>
                                                <p className="font-medium text-amber-900">{issue.title}</p>
                                                <p className="text-sm text-amber-700 mt-1">{issue.description}</p>
                                            </div>
                                            <Button size="sm" variant="outline" className="text-amber-700 border-amber-200 hover:bg-amber-100" onClick={() => handleJumpToIssue(issue)}>
                                                Check
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* Empty State */}
                    {isPass && warnings.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-200" />
                            <p>No issues found. Your draft is clean!</p>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t bg-muted/20 flex justify-end gap-3">
                    <Button variant="outline" onClick={clearValidation}>
                        Back to Edit
                    </Button>
                    <Button
                        disabled={!isPass}
                        className={isPass ? "bg-green-600 hover:bg-green-700" : ""}
                        onClick={() => {
                            clearValidation();
                            // Proceed to analysis
                            window.location.href = '/analysis/new'; // Or wherever the next step is
                        }}
                    >
                        Proceed to Analysis
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                </div>
            </Card>
        </div>
    );
}
