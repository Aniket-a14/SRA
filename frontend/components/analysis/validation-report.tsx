"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, CheckCircle, XCircle, Info, ShieldAlert, FileWarning, HelpCircle, X, Loader2, RotateCcw, Sparkles } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
    isProceeding?: boolean;
    onSubmitClarifications?: (answers: Record<string, string>) => void;
    onAutoFix?: (issueId: string) => void;
    isFixing?: string | null;
    /** The brief captured in the composer — editable here, never re-asked from scratch. */
    projectName: string;
    description: string;
    onBriefChange: (field: 'projectName' | 'description', value: string) => void;
    onRevalidate: () => void;
    isValidating?: boolean;
    /** Set when the quality check could not run at all (AI unavailable, quota, timeout). */
    validationError?: { title?: string; message?: string } | null;
    /** False until a check has actually produced a verdict. */
    hasValidated?: boolean;
}

/**
 * The single pre-generation surface: your brief and what the quality gate made of it, on one
 * screen. There is deliberately no separate "fill in the form" step — the composer already
 * collected the only two fields that exist (name + description), so a second input layer just
 * re-asked for what the user had already typed. Editing happens inline, right next to the
 * findings the edit is meant to address.
 */
export function ValidationReport({
    issues,
    clarificationQuestions = [],
    onProceed,
    isProceeding,
    onSubmitClarifications,
    onAutoFix,
    isFixing,
    projectName,
    description,
    onBriefChange,
    onRevalidate,
    isValidating,
    validationError,
    hasValidated,
}: ValidationReportProps) {
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
    const visibleIssues = issues.filter(i => !dismissedIds.has(i.id));
    const criticalCount = visibleIssues.filter(i => i.severity === 'critical').length;
    const warningCount = visibleIssues.filter(i => i.severity === 'warning').length;
    const [answers, setAnswers] = useState<Record<string, string>>({});

    // Only genuine blockers in a verdict we actually received may gate generation. A check
    // that never ran must not: otherwise an unavailable AI service silently becomes a hard
    // stop on the whole product, with nothing the user can do to clear it.
    const isBlocked = criticalCount > 0;
    const isClarificationNeeded = clarificationQuestions.length > 0;

    const handleDismiss = (id: string) => {
        setDismissedIds(prev => new Set(prev).add(id));
    };

    const handleAnswerChange = (idx: number, value: string) => {
        setAnswers(prev => ({ ...prev, [idx]: value }));
    }

    const handleSubmitClarifications = () => {
        if (onSubmitClarifications) {
            onSubmitClarifications(answers);
        }
    }

    const briefEditor = (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Your brief</CardTitle>
                <CardDescription>
                    Edit it here and re-run the check — the findings below refer to this text.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-1.5">
                    <Label htmlFor="brief-project-name">Project name</Label>
                    <Input
                        id="brief-project-name"
                        value={projectName}
                        onChange={(e) => onBriefChange('projectName', e.target.value)}
                        placeholder="Name your project"
                        disabled={isValidating || isProceeding}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="brief-description">What the system should do</Label>
                    <Textarea
                        id="brief-description"
                        value={description}
                        onChange={(e) => onBriefChange('description', e.target.value)}
                        placeholder="Describe what the system should do…"
                        className="min-h-[160px] leading-relaxed"
                        disabled={isValidating || isProceeding}
                    />
                </div>
            </CardContent>
        </Card>
    );

    const footer = (
        <div className="flex flex-wrap justify-between items-center gap-3 sticky bottom-0 -mx-6 px-6 py-4 bg-background border-t z-10">
            {/* A disabled button with no stated reason reads as a broken page. If the gate is
                closed, say what closed it and what opens it again. */}
            <p className="text-xs text-muted-foreground max-w-md">
                {isBlocked
                    ? `${criticalCount} item${criticalCount === 1 ? "" : "s"} must be resolved first — edit your brief and re-run the check, apply a suggested fix, or dismiss any finding you disagree with.`
                    : " "}
            </p>
            <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" onClick={onRevalidate} disabled={isValidating || isProceeding}>
                    {isValidating
                        ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking…</>
                        : <><RotateCcw className="h-4 w-4 mr-2" /> {hasValidated ? "Re-run check" : "Run check"}</>}
                </Button>
                <Button onClick={onProceed} disabled={isBlocked || isProceeding || isValidating} size="lg">
                    {isProceeding
                        ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting…</>
                        : <><Sparkles className="h-4 w-4 mr-2" /> Generate specification</>}
                </Button>
            </div>
        </div>
    );

    if (isClarificationNeeded) {
        return (
            <div className="max-w-4xl mx-auto space-y-6 p-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">A few things need clarifying</h2>
                    <p className="text-muted-foreground">
                        Answer these so the generator never has to guess at your intent.
                    </p>
                </div>

                {briefEditor}

                <Card className="border-amber-200 bg-amber-50/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <HelpCircle className="h-5 w-5 text-amber-600" />
                            Questions about your brief
                        </CardTitle>
                        <CardDescription>
                            These are the gaps that would otherwise be filled in with assumptions.
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

                <div className="flex flex-wrap justify-end items-center gap-3 sticky bottom-0 -mx-6 px-6 py-4 bg-background border-t z-10">
                    <Button variant="outline" onClick={onRevalidate} disabled={isValidating}>
                        {isValidating
                            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking…</>
                            : <><RotateCcw className="h-4 w-4 mr-2" /> Re-run check</>}
                    </Button>
                    <Button
                        onClick={handleSubmitClarifications}
                        disabled={Object.keys(answers).length < clarificationQuestions.length}
                        size="lg"
                    >
                        Submit answers
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Review before generating</h2>
                    <p className="text-muted-foreground">
                        We checked your brief for gaps the generator would otherwise have to guess at.
                    </p>
                </div>
                {isBlocked ? (
                    <Badge variant="destructive" className="px-4 py-1 text-sm">
                        Needs attention
                    </Badge>
                ) : hasValidated && !validationError ? (
                    <Badge variant="outline" className="px-4 py-1 text-sm text-green-600 border-green-600">
                        Ready to generate
                    </Badge>
                ) : null}
            </div>

            {briefEditor}

            {/* The check could not run. This is a technical failure, not a verdict on the
                brief — say so, and leave generation available rather than stranding the user
                on a gate that will never open. */}
            {validationError && (
                <Card className="border-destructive/40 bg-destructive/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            {validationError.title || "We couldn't check your brief"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                            {validationError.message || "The quality check is unavailable right now."}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Your brief is saved. You can retry the check, or generate the
                            specification without it.
                        </p>
                    </CardContent>
                </Card>
            )}

            {!hasValidated && !validationError && (
                <Card>
                    <CardContent className="py-6 text-center text-muted-foreground text-sm">
                        Your brief has not been checked yet. Run the check, or generate straight away.
                    </CardContent>
                </Card>
            )}

            {hasValidated && !validationError && (
                <>
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Must fix</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-destructive flex items-center gap-2">
                                    <XCircle className="h-6 w-6" /> {criticalCount}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Worth a look</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-amber-500 flex items-center gap-2">
                                    <AlertTriangle className="h-6 w-6" /> {warningCount}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Clarity</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600 flex items-center gap-2">
                                    <CheckCircle className="h-6 w-6" /> {(() => {
                                        const blockerWeight = 15;
                                        const warningWeight = 5;
                                        const totalDeduction = (criticalCount * blockerWeight) + (warningCount * warningWeight);
                                        return Math.max(0, Math.round(100 - totalDeduction));
                                    })()}%
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Findings</CardTitle>
                            <CardDescription>Each one is something the generator would have to invent.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {visibleIssues.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground">
                                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                                    <p>Nothing to flag — your brief is clear enough to generate from.</p>
                                </div>
                            )}
                            {visibleIssues.map((issue) => (
                                <div key={issue.id} className="flex items-start gap-4 p-4 border rounded-lg bg-card group hover:border-primary/50 transition-colors">
                                    {issue.severity === 'critical' ? (
                                        issue.conflict_type === 'HARD_CONFLICT' ? <ShieldAlert className="h-5 w-5 text-red-600 mt-0.5" /> : <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                                    ) : issue.severity === 'warning' ? (
                                        issue.conflict_type === 'SOFT_DRIFT' ? <FileWarning className="h-5 w-5 text-amber-600 mt-0.5" /> : <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                                    ) : (
                                        <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                                    )}

                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-semibold flex flex-wrap items-center gap-2">
                                            {issue.title || issue.message}
                                            {issue.section && <Badge variant="secondary" className="text-[10px]">{issue.section}</Badge>}
                                            {issue.conflict_type === 'HARD_CONFLICT' && <Badge variant="destructive" className="text-[10px] bg-red-600">CONFLICT</Badge>}
                                            {issue.conflict_type === 'SOFT_DRIFT' && <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-600">SCOPE DRIFT</Badge>}
                                        </h4>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {issue.description || "No detailed description provided."}
                                        </p>
                                        <p className="text-xs font-medium text-foreground/70 mt-2">
                                            {issue.severity === 'critical' ? "Must be resolved before generating." : "Recommended, not required."}
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
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                                        onClick={() => handleDismiss(issue.id)}
                                        title="Dismiss this issue"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </>
            )}

            {footer}
        </div>
    )
}
