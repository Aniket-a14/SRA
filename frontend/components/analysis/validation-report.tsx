"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, CheckCircle, XCircle, Info, ShieldAlert, FileWarning, HelpCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft } from "lucide-react"

interface Issue {
    id: string;
    severity: 'critical' | 'warning' | 'info';
    message?: string;
    title?: string;
    description?: string;
    section?: string;
    conflict_type?: 'HARD_CONFLICT' | 'SOFT_DRIFT' | 'NONE';
    suggested_fix?: string;
}

interface ValidationReportProps {
    issues: Issue[];
    clarificationQuestions?: string[];
    onProceed: () => void;
    onEdit: () => void;
    isProceeding?: boolean;
    onSubmitClarifications?: (answers: Record<string, string>) => void;
    onAutoFix?: (issueId: string) => void;
    isFixing?: string | null;
}

export function ValidationReport({ issues, clarificationQuestions = [], onProceed, onEdit, isProceeding, onSubmitClarifications, onAutoFix, isFixing }: ValidationReportProps) {
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const [answers, setAnswers] = useState<Record<string, string>>({});

    const isBlocked = criticalCount > 0;
    const isClarificationNeeded = clarificationQuestions.length > 0;

    const handleAnswerChange = (idx: number, value: string) => {
        setAnswers(prev => ({ ...prev, [idx]: value }));
    }

    const handleSubmitClarifications = () => {
        if (onSubmitClarifications) {
            onSubmitClarifications(answers);
        }
    }

    if (isClarificationNeeded) {
        return (
            <div className="max-w-4xl mx-auto space-y-6 pb-20 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Clarification Required</h2>
                        <p className="text-muted-foreground">Layer 2 needs your input to resolve ambiguities.</p>
                    </div>
                </div>

                <Card className="border-amber-200 bg-amber-50/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <HelpCircle className="h-5 w-5 text-amber-600" />
                            Questions from the System
                        </CardTitle>
                        <CardDescription>
                            Please answer the following questions to help us understand your requirements better.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {clarificationQuestions.map((question, idx) => (
                            <div key={idx} className="space-y-2">
                                <p className="font-medium text-sm">{idx + 1}. {question}</p>
                                <Textarea
                                    placeholder="Type your answer here..."
                                    value={answers[idx] || ""}
                                    onChange={(e) => handleAnswerChange(idx, e.target.value)}
                                    className="bg-white"
                                />
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <div className="flex justify-end items-center gap-4 fixed bottom-0 left-0 right-0 p-4 bg-background border-t z-10 md:pl-64">
                    <Button variant="outline" onClick={onEdit}>
                        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Inputs
                    </Button>
                    <Button onClick={handleSubmitClarifications} disabled={Object.keys(answers).length < clarificationQuestions.length} size="lg">
                        Submit Clarifications
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Validation Report</h2>
                    <p className="text-muted-foreground">Layer 2: Quality Gatekeeper</p>
                </div>
                {isBlocked ? (
                    <Badge variant="destructive" className="px-4 py-1 text-sm">
                        Analysis Blocked
                    </Badge>
                ) : (
                    <Badge variant="outline" className="px-4 py-1 text-sm text-green-600 border-green-600">
                        Ready for Analysis
                    </Badge>
                )}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-destructive flex items-center gap-2">
                            <XCircle className="h-6 w-6" /> {criticalCount}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Warnings</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-500 flex items-center gap-2">
                            <AlertTriangle className="h-6 w-6" /> {warningCount}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Passed Checks</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600 flex items-center gap-2">
                            <CheckCircle className="h-6 w-6" /> {100 - issues.length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Detailed Findings</CardTitle>
                    <CardDescription>Review the following items before proceeding.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {issues.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                            <p>No issues found. Your inputs are high quality.</p>
                        </div>
                    )}
                    {issues.map((issue) => (
                        <div key={issue.id} className="flex items-start gap-4 p-4 border rounded-lg bg-card group hover:border-primary/50 transition-colors">
                            {issue.severity === 'critical' ? (
                                issue.conflict_type === 'HARD_CONFLICT' ? <ShieldAlert className="h-5 w-5 text-red-600 mt-0.5" /> : <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                            ) : issue.severity === 'warning' ? (
                                issue.conflict_type === 'SOFT_DRIFT' ? <FileWarning className="h-5 w-5 text-amber-600 mt-0.5" /> : <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                            ) : (
                                <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                            )}

                            <div className="flex-1">
                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                    {issue.title || issue.message}
                                    {issue.section && <Badge variant="secondary" className="text-[10px]">{issue.section}</Badge>}
                                    {issue.conflict_type === 'HARD_CONFLICT' && <Badge variant="destructive" className="text-[10px] bg-red-600">SEMANTIC CONFLICT</Badge>}
                                    {issue.conflict_type === 'SOFT_DRIFT' && <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-600">SCOPE DRIFT</Badge>}
                                </h4>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {issue.description || "No detailed description provided."}
                                </p>
                                <p className="text-xs font-medium text-foreground/70 mt-2">
                                    {issue.severity === 'critical' ? "Status: Must be resolved." : "Status: Recommended fix."}
                                </p>
                                {issue.suggested_fix && (
                                    <div className="mt-2 space-y-2">
                                        <div className="text-xs bg-muted/50 p-2 rounded text-foreground/80 border border-border/50">
                                            <span className="font-semibold text-primary/80">Suggestion: </span>{issue.suggested_fix}
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="h-7 text-[10px] gap-1.5"
                                            onClick={() => onAutoFix && onAutoFix(issue.id)}
                                            disabled={isFixing === issue.id}
                                        >
                                            <ShieldAlert className="h-3 w-3" />
                                            {isFixing === issue.id ? "Fixing..." : "Apply AI Fix"}
                                        </Button>
                                    </div>
                                )}
                            </div>
                            <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <div className="flex justify-end items-center gap-4 fixed bottom-0 left-0 right-0 p-4 bg-background border-t z-10 md:pl-64">
                <Button variant="outline" onClick={onEdit}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to Inputs
                </Button>
                <Button onClick={onProceed} disabled={isBlocked || isProceeding} size="lg">
                    {isProceeding ? "Proceeding..." : "Generate SRS Analysis (Layer 3)"}
                </Button>
            </div>
        </div>
    )
}
