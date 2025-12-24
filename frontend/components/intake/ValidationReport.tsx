"use client";

import React from 'react';
import { useIntake } from '@/lib/intake-context';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { CheckCircle, XCircle, AlertTriangle, ArrowRight, X } from 'lucide-react';
import { Badge } from '../ui/badge';
import { ValidationIssue } from '@/types/srs-intake';
import { FileWarning, ShieldAlert } from 'lucide-react';

export function ValidationReport() {
    const { validationResult, clearValidation, setActiveSection } = useIntake();

    if (!validationResult) return null;

    const isPass = validationResult.validation_status === 'PASS';
    const blockers = validationResult.issues.filter(i => i.severity === 'BLOCKER');
    const warnings = validationResult.issues.filter(i => i.severity === 'WARNING');
    const allIssues = [...blockers, ...warnings];

    const handleJumpToIssue = (issue: ValidationIssue) => {
        clearValidation();
        setActiveSection(issue.section_id);
    }

    // Helper to get icon and color based on conflict type
    const getIssueConfig = (issue: ValidationIssue) => {
        if (issue.conflict_type === 'HARD_CONFLICT') {
            return {
                icon: <ShieldAlert className="w-5 h-5 text-red-600" />,
                borderColor: 'border-l-red-600',
                bgColor: 'bg-red-50',
                badgeVariant: 'destructive' as const,
                titleColor: 'text-red-900',
                badgeText: 'SEMANTIC CONFLICT'
            };
        }
        if (issue.conflict_type === 'SOFT_DRIFT') {
            return {
                icon: <FileWarning className="w-5 h-5 text-amber-600" />,
                borderColor: 'border-l-amber-500',
                bgColor: 'bg-amber-50',
                badgeVariant: 'secondary' as const,
                titleColor: 'text-amber-900',
                badgeText: 'SCOPE DRIFT'
            };
        }
        // Fallbacks
        return issue.severity === 'BLOCKER' ? {
            icon: <XCircle className="w-5 h-5 text-red-500" />,
            borderColor: 'border-l-red-500',
            bgColor: 'bg-red-50/50',
            badgeVariant: 'destructive' as const,
            titleColor: 'text-red-900',
            badgeText: issue.issue_type
        } : {
            icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
            borderColor: 'border-l-amber-500',
            bgColor: 'bg-amber-50/50',
            badgeVariant: 'secondary' as const,
            titleColor: 'text-amber-900',
            badgeText: issue.issue_type
        };
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <Card className="w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                <CardHeader className={`border-b ${isPass ? 'bg-green-50' : 'bg-red-50'}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {isPass ? (
                                <CheckCircle className="w-8 h-8 text-green-600" />
                            ) : (
                                <ShieldAlert className="w-8 h-8 text-red-600" />
                            )}
                            <div>
                                <CardTitle className="text-2xl">
                                    {isPass ? 'Ready for Analysis' : 'Validation Issues Found'}
                                </CardTitle>
                                <p className="text-muted-foreground">
                                    {isPass
                                        ? "Your SRS draft meets the basic semantic requirements."
                                        : "Please resolve the marked issues. The Introduction acts as the semantic anchor."}
                                </p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={clearValidation}>
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </CardHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Render all issues together, sorted by severity/importance */}
                    {allIssues.map((issue, idx) => {
                        const config = getIssueConfig(issue);
                        return (
                            <Card key={idx} className={`border-l-4 ${config.borderColor} ${config.bgColor}`}>
                                <CardContent className="pt-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 mr-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Badge variant={config.badgeVariant} className="rounded-sm">
                                                    {config.badgeText}
                                                </Badge>
                                                <span className="font-mono text-xs text-muted-foreground">
                                                    Section {issue.subsection_id || issue.section_id}
                                                </span>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <span className="mt-1 flex-shrink-0">{config.icon}</span>
                                                <div>
                                                    <p className={`font-semibold ${config.titleColor}`}>{issue.title}</p>
                                                    <p className="text-sm text-foreground/80 mt-1">{issue.description}</p>
                                                </div>
                                            </div>

                                            {issue.suggested_fix && (
                                                <div className="mt-3 ml-8 text-sm bg-white/60 p-3 rounded border border-black/5">
                                                    <span className="font-semibold text-primary/80 block mb-1">Suggested Fix: </span>
                                                    {issue.suggested_fix}
                                                </div>
                                            )}
                                        </div>
                                        <Button size="sm" variant="outline" onClick={() => handleJumpToIssue(issue)}>
                                            Fix in {issue.section_id}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}

                    {/* Empty State */}
                    {isPass && warnings.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-200" />
                            <p>No issues found. Your draft is semantically consistent.</p>
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
