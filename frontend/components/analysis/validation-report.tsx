"use client"

import { Button } from "@/components/ui/button"
import { AlertTriangle, CheckCircle, XCircle, Info, ShieldAlert, FileWarning } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface Issue {
    id: string;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    section?: string;
    conflict_type?: 'HARD_CONFLICT' | 'SOFT_DRIFT' | 'NONE';
    suggested_fix?: string;
}

interface ValidationReportProps {
    issues: Issue[];
    onProceed: () => void;
    onEdit: () => void;
}

export function ValidationReport({ issues, onProceed, onEdit }: ValidationReportProps) {
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;

    const isBlocked = criticalCount > 0;

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
                                    {issue.message}
                                    {issue.section && <Badge variant="secondary" className="text-[10px]">{issue.section}</Badge>}
                                    {issue.conflict_type === 'HARD_CONFLICT' && <Badge variant="destructive" className="text-[10px] bg-red-600">SEMANTIC CONFLICT</Badge>}
                                    {issue.conflict_type === 'SOFT_DRIFT' && <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-600">SCOPE DRIFT</Badge>}
                                </h4>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {issue.severity === 'critical' ? "Must be resolved." : "Recommended fix."}
                                </p>
                                {issue.suggested_fix && (
                                    <div className="mt-2 text-xs bg-muted/50 p-2 rounded text-foreground/80">
                                        <span className="font-semibold">Fix: </span>{issue.suggested_fix}
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
                <Button onClick={onProceed} disabled={isBlocked} size="lg">
                    Generate SRS Analysis (Layer 3)
                </Button>
            </div>
        </div>
    )
}

import { ArrowLeft } from "lucide-react"
