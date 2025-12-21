"use client"

import { useEffect, useRef, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { AlertTriangle, Bot, ShieldCheck, Code, Loader2, Bug, CheckCircle2 } from "lucide-react"
import type { AnalysisResult } from "@/types/analysis"
import { DiagramEditor } from "@/components/diagram-editor"
import { useAuth } from "@/lib/auth-context"
import { Progress } from "@/components/ui/progress"
import { useParams, useRouter } from "next/navigation"
import { CodeViewer } from "@/components/code-viewer"
import { toast } from "sonner"
import { FeatureDisplay } from "@/components/feature-display"
import { KVDisplay } from "@/components/kv-display"
import { renderMarkdown } from "@/lib/render-markdown"


interface ResultsTabsProps {
  data?: AnalysisResult
  onDiagramEditChange?: (isEditing: boolean) => void
  onRefresh?: () => void
}

export function ResultsTabs({ data, onDiagramEditChange, onRefresh }: ResultsTabsProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const { token } = useAuth()
  const router = useRouter()
  const params = useParams()
  const analysisId = params?.id as string

  const [isGeneratingCode, setIsGeneratingCode] = useState(false)
  const [codeError, setCodeError] = useState("")

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-fade-up")
            if (entry.target instanceof HTMLElement) {
              entry.target.style.opacity = "1";
            }
          }
        })
      },
      { threshold: 0.05 },
    )

    const elements = sectionRef.current?.querySelectorAll(".animate-on-scroll")
    elements?.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [generatedCode, setGeneratedCode] = useState<any>(data?.generatedCode || null)

  if (!data) {
    return null
  }

  const {
    introduction,
    overallDescription,
    externalInterfaceRequirements,
    systemFeatures,
    nonFunctionalRequirements,
    glossary,
    appendices,
    missingLogic = [],
    contradictions = [],
    qualityAudit,
  } = data

  return (
    <section ref={sectionRef} className="py-12 sm:py-16">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8 animate-on-scroll opacity-0">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary animate-pulse-glow shadow-lg shadow-primary/20">
                <Bot className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight mb-1">Analysis Report</h2>
                <p className="text-muted-foreground">
                  IEEE 830-1998 Compliant Software Requirements Specification
                </p>
              </div>
            </div>
          </div>

          <Tabs defaultValue="intro" className="w-full animate-on-scroll opacity-0 delay-200">
            <ScrollArea className="w-full mb-8">
              <TabsList className="inline-flex w-max bg-secondary p-1">
                <TabsTrigger value="intro" className="px-4 py-2">Introduction</TabsTrigger>
                <TabsTrigger value="features" className="px-4 py-2">System Features</TabsTrigger>
                <TabsTrigger value="interfaces" className="px-4 py-2">Ext. Interfaces</TabsTrigger>
                <TabsTrigger value="nfrs" className="px-4 py-2">Non-Functional</TabsTrigger>
                <TabsTrigger value="appendices" className="px-4 py-2">Appendices</TabsTrigger>
                <TabsTrigger value="code" className="px-4 py-2">Code Assets</TabsTrigger>
                <TabsTrigger value="quality" className="px-4 py-2">Quality Audit</TabsTrigger>
              </TabsList>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            {/* TAB: INTRODUCTION */}
            <TabsContent value="intro" className="space-y-8 animate-fade-in outline-none">
              <div className="grid gap-8 lg:grid-cols-2">
                <KVDisplay
                  title="1. Introduction"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  data={introduction as unknown as Record<string, any>}
                />
                <KVDisplay
                  title="2. Overall Description"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  data={overallDescription as unknown as Record<string, any>}
                />
              </div>

              {/* Issues / Contradictions (Global) */}
              {((missingLogic && missingLogic.length > 0) || (contradictions && contradictions.length > 0)) && (
                <div className="grid gap-6 md:grid-cols-2">
                  {missingLogic.length > 0 && (
                    <Card className="bg-amber-500/5 border-amber-500/20">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-amber-500 text-lg">
                          <AlertTriangle className="h-5 w-5" />
                          Missing Logic
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="list-disc list-inside space-y-2">
                          {missingLogic.map((item, i) => (
                            <li key={i} className="text-sm text-foreground/80">{item}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                  {contradictions && contradictions.length > 0 && (
                    <Card className="bg-destructive/5 border-destructive/20">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-destructive text-lg">
                          <Bug className="h-5 w-5" />
                          Contradictions Found
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="list-disc list-inside space-y-2">
                          {contradictions.map((item, i) => (
                            <li key={i} className="text-sm text-foreground/80">{item}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </TabsContent>

            {/* TAB: SYSTEM FEATURES */}
            <TabsContent value="features" className="space-y-6 animate-fade-in outline-none">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-semibold">3. System Features</h3>
              </div>
              <FeatureDisplay features={systemFeatures} projectTitle={data.projectTitle} />
            </TabsContent>

            {/* TAB: EXTERNAL INTERFACES */}
            <TabsContent value="interfaces" className="space-y-6 animate-fade-in outline-none">
              <KVDisplay
                title="External Interface Requirements"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data={externalInterfaceRequirements as unknown as Record<string, any>}
              />
            </TabsContent>

            {/* TAB: NON-FUNCTIONAL REQS */}
            <TabsContent value="nfrs" className="space-y-6 animate-fade-in outline-none">
              <KVDisplay
                title="Non-Functional Requirements"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data={nonFunctionalRequirements as unknown as Record<string, any>}
                projectTitle={data.projectTitle}
              />

              {data.otherRequirements && data.otherRequirements.length > 0 && (
                <Card className="bg-card border-border mt-6">
                  <CardHeader>
                    <CardTitle>Other Requirements</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2">
                      {data.otherRequirements.map((req, i) => {
                        const cleanReq = req.replace(/^[A-Z]+-[A-Z]+-\d+\s*:?\s*/, '').replace(/^[\s\*\-\•\d\.\)]+\s*/, '').trim();
                        const acronym = data.projectTitle ? data.projectTitle.replace(/[^a-zA-Z\s]/g, "").split(/\s+/).map(w => w[0]).join("").toUpperCase() : "SRA";

                        return (
                          <div key={i} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                            <Badge variant="outline" className="shrink-0 mt-0.5 text-xs text-muted-foreground bg-muted/20 border-muted-foreground/20">
                              {acronym}-OR-{i + 1}
                            </Badge>
                            <span className="text-sm text-muted-foreground leading-relaxed">{renderMarkdown(cleanReq)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* TAB: APPENDICES */}
            <TabsContent value="appendices" className="space-y-8 animate-fade-in outline-none">
              {/* Diagrams */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-l-4 border-primary pl-3">Analysis Models</h3>
                <div className="grid lg:grid-cols-2 gap-6">
                  <DiagramEditor
                    title="Flowchart"
                    initialCode={appendices?.analysisModels?.flowchartDiagram || ""}
                    onSave={async (newCode) => {
                      try {
                        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${analysisId}`, {
                          method: "PUT",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`
                          },
                          body: JSON.stringify({
                            appendices: {
                              ...appendices,
                              analysisModels: {
                                ...appendices?.analysisModels,
                                flowchartDiagram: newCode
                              }
                            }
                          })
                        })
                        if (!res.ok) throw new Error("Failed to save")
                        const updated = await res.json()
                        if (updated.id && updated.id !== analysisId) {
                          toast.success("New version created")
                          router.push(`/analysis/${updated.id}`)
                        } else {
                          toast.success("Saved")
                          onRefresh?.()
                        }
                      } catch {
                        toast.error("Failed to save diagram")
                      }
                    }}
                    onOpenChange={onDiagramEditChange}
                  />
                  <DiagramEditor
                    title="Sequence Diagram"
                    initialCode={appendices?.analysisModels?.sequenceDiagram || ""}
                    onSave={async (newCode) => {
                      try {
                        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${analysisId}`, {
                          method: "PUT",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`
                          },
                          body: JSON.stringify({
                            appendices: {
                              ...appendices,
                              analysisModels: {
                                ...appendices?.analysisModels,
                                sequenceDiagram: newCode
                              }
                            }
                          })
                        })
                        if (!res.ok) throw new Error("Failed to save")
                        const updated = await res.json()
                        if (updated.id && updated.id !== analysisId) {
                          toast.success("New version created")
                          router.push(`/analysis/${updated.id}`)
                        } else {
                          toast.success("Saved")
                          onRefresh?.()
                        }
                      } catch {
                        toast.error("Failed to save diagram")
                      }
                    }}
                    onOpenChange={onDiagramEditChange}
                  />
                </div>
                <div className="grid lg:grid-cols-2 gap-6 mt-6">
                  <DiagramEditor
                    title="Data Flow Diagram"
                    initialCode={appendices?.analysisModels?.dataFlowDiagram || ""}
                    onSave={async (newCode) => {
                      try {
                        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${analysisId}`, {
                          method: "PUT",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`
                          },
                          body: JSON.stringify({
                            appendices: {
                              ...appendices,
                              analysisModels: {
                                ...appendices?.analysisModels,
                                dataFlowDiagram: newCode
                              }
                            }
                          })
                        })
                        if (!res.ok) throw new Error("Failed to save")
                        const updated = await res.json()
                        if (updated.id && updated.id !== analysisId) {
                          toast.success("New version created")
                          router.push(`/analysis/${updated.id}`)
                        } else {
                          toast.success("Saved")
                          onRefresh?.()
                        }
                      } catch {
                        toast.error("Failed to save diagram")
                      }
                    }}
                    onOpenChange={onDiagramEditChange}
                  />
                  <DiagramEditor
                    title="Entity Relationship Diagram"
                    initialCode={appendices?.analysisModels?.entityRelationshipDiagram || ""}
                    onSave={async (newCode) => {
                      try {
                        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${analysisId}`, {
                          method: "PUT",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`
                          },
                          body: JSON.stringify({
                            appendices: {
                              ...appendices,
                              analysisModels: {
                                ...appendices?.analysisModels,
                                entityRelationshipDiagram: newCode
                              }
                            }
                          })
                        })
                        if (!res.ok) throw new Error("Failed to save")
                        const updated = await res.json()
                        if (updated.id && updated.id !== analysisId) {
                          toast.success("New version created")
                          router.push(`/analysis/${updated.id}`)
                        } else {
                          toast.success("Saved")
                          onRefresh?.()
                        }
                      } catch {
                        toast.error("Failed to save diagram")
                      }
                    }}
                    onOpenChange={onDiagramEditChange}
                  />
                </div>
              </div>

              {/* Glossary */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-l-4 border-primary pl-3">Glossary</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {glossary && glossary.length > 0 ? (
                    glossary.map((term, i) => (
                      <Card key={i} className="bg-card">
                        <CardContent className="pt-4">
                          <dt className="font-semibold text-primary mb-1">{term.term}</dt>
                          <dd className="text-sm text-muted-foreground">{term.definition}</dd>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm col-span-full">No glossary terms found.</p>
                  )}
                </div>
              </div>

              {/* TBD List */}
              {appendices?.tbdList && appendices.tbdList.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-l-4 border-primary pl-3">To Be Determined (TBD)</h3>
                  <Card>
                    <CardContent className="pt-4">
                      <ul className="list-disc list-inside space-y-2">
                        {appendices.tbdList.map((item, i) => (
                          <li key={i} className="text-sm text-muted-foreground">{item}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            {/* TAB: CODE GENERATION */}
            <TabsContent value="code" className="animate-fade-in outline-none">
              {!generatedCode && !isGeneratingCode ? (
                <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 border rounded-lg bg-card border-dashed">
                  <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <Code className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">Generate Project Code</h3>
                    <p className="text-muted-foreground max-w-md mt-2">
                      Ask AI to scaffold your project structure, database schema, API routes, and React components based on these requirements.
                    </p>
                  </div>
                  <Button
                    className="mt-4"
                    onClick={async () => {
                      setIsGeneratingCode(true);
                      setCodeError("");
                      try {
                        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${analysisId}/code`, {
                          method: "POST",
                          headers: { Authorization: `Bearer ${token}` }
                        });
                        if (!res.ok) throw new Error("Failed to generate code");
                        const js = await res.json();
                        setGeneratedCode(js);
                      } catch (e) {
                        console.error(e);
                        setCodeError("Failed to generate code. Please try again.");
                      } finally {
                        setIsGeneratingCode(false);
                      }
                    }}
                  >
                    Generate Code Assets
                  </Button>
                </div>
              ) : isGeneratingCode ? (
                <div className="flex flex-col items-center justify-center p-12 space-y-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse-glow" />
                    <Loader2 className="h-12 w-12 animate-spin text-primary relative z-10" />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-medium">Scaffolding your project...</h3>
                    <p className="text-sm text-muted-foreground">Generating schema, API routes, and components.</p>
                  </div>
                </div>
              ) : generatedCode ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      <Code className="h-5 w-5 text-primary" />
                      Generated Project Assets
                    </h3>
                    <Button variant="outline" size="sm" onClick={() => setGeneratedCode(null)}>
                      Regeneration Options
                    </Button>
                  </div>
                  <CodeViewer {...generatedCode} />
                </div>
              ) : (
                <div className="p-8 text-destructive text-center">{codeError}</div>
              )}
            </TabsContent>

            {/* TAB: QUALITY AUDIT */}
            <TabsContent value="quality" className="animate-fade-in outline-none">
              {qualityAudit ? (
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ShieldCheck className="h-5 w-5 text-primary" />
                      Requirements Quality Score: {qualityAudit.score}/100
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Quality Check</span>
                        <span className={qualityAudit.score >= 80 ? "text-green-500" : qualityAudit.score >= 50 ? "text-amber-500" : "text-destructive"}>
                          {qualityAudit.score >= 80 ? "Excellent" : qualityAudit.score >= 50 ? "Needs Improvement" : "Poor"}
                        </span>
                      </div>
                      <Progress value={qualityAudit.score} className={qualityAudit.score >= 80 ? "bg-secondary text-green-500" : "bg-secondary"} indicatorClassName={qualityAudit.score >= 80 ? "bg-green-500" : qualityAudit.score >= 50 ? "bg-amber-500" : "bg-destructive"} />
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm">Identified Issues</h4>
                      {qualityAudit.issues.length > 0 ? (
                        <ul className="space-y-3">
                          {qualityAudit.issues.map((issue, index) => (
                            <li key={index} className="flex items-start gap-3 text-sm bg-muted/30 p-3 rounded-md border border-border/50">
                              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                              <span>{issue}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="flex items-center gap-2 text-green-500 text-sm p-4 bg-green-500/10 rounded-md">
                          <CheckCircle2 className="h-4 w-4" /> {/* Need to import CheckCircle2 */}
                          No issues found. Great job!
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="text-center p-8 text-muted-foreground">
                  No quality audit data available for this analysis.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </section>
  )
}


