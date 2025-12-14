"use client"

import { useEffect, useRef, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { StoryCard } from "@/components/story-card"
import { ApiCard } from "@/components/api-card"
import { CheckCircle2, AlertTriangle, Bot, ShieldCheck, Bug, Edit, Plus } from "lucide-react"
import type { AnalysisResult } from "@/types/analysis"
import { DiagramEditor } from "@/components/diagram-editor"
import { useAuth } from "@/lib/auth-context"
import { Progress } from "@/components/ui/progress"
import { useParams, useRouter } from "next/navigation"
import { CodeViewer } from "@/components/code-viewer"
import { Code, Loader2 } from "lucide-react"
import { EditableSection } from "@/components/editable-section"
import { toast } from "sonner"

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

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Local Data State for Editing
  const [localFunctionalReqs, setLocalFunctionalReqs] = useState<string[]>([])
  const [localNonFunctionalReqs, setLocalNonFunctionalReqs] = useState<string[]>([])
  const [localUserStories, setLocalUserStories] = useState<NonNullable<AnalysisResult['userStories']>>([])

  useEffect(() => {
    if (data) {
      setLocalFunctionalReqs(data.functionalRequirements || [])
      setLocalNonFunctionalReqs(data.nonFunctionalRequirements || [])
      setLocalUserStories(data.userStories || [])
    }
  }, [data])


  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-fade-up")
            if (entry.target instanceof HTMLElement) {
              entry.target.style.opacity = "1"; // Ensure opacity is set to 1 when visible
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

  const {
    cleanedRequirements = "",
    functionalRequirements = [],
    nonFunctionalRequirements = [],
    entities = [],
    userStories = [],
    acceptanceCriteria = [],
    apiContracts = [],
    missingLogic = [],
    contradictions = [],
    flowchartDiagram = "",
    sequenceDiagram = "",
    qualityAudit,
    generatedCode: initialGeneratedCode,
  } = data || {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [generatedCode, setGeneratedCode] = useState<any>(initialGeneratedCode || null)

  if (!data) {
    // console.warn("ResultsTabs: No data provided!");
    return null
  }

  const handleSaveChanges = async () => {
    setIsSaving(true)
    try {
      // Construct the payload with ALL data, but updated fields
      // Ideally backend only needs changed fields, but providing all context is safer for now if backend logic expects complete object replacement structure or partial merges
      const payload = {
        functionalRequirements: localFunctionalReqs,
        nonFunctionalRequirements: localNonFunctionalReqs,
        userStories: localUserStories
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${analysisId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error("Failed to save changes")
      }

      const newAnalysis = await response.json()

      toast.success("New version created successfully!")
      setIsEditing(false)

      // Redirect to new version
      if (newAnalysis.id && newAnalysis.id !== analysisId) {
        router.push(`/analysis/${newAnalysis.id}`)
      } else {
        // If for some reason ID didn't change (should not happen with new versioning logic), just reload
        router.refresh()
      }

    } catch (error) {
      console.error("Save failed:", error)
      toast.error("Failed to save changes")
    } finally {
      setIsSaving(false)
    }
  }

  const handleUserStoryUpdate = (index: number, updatedStory: NonNullable<AnalysisResult['userStories']>[0]) => {
    const newStories = [...localUserStories];
    newStories[index] = updatedStory;
    setLocalUserStories(newStories);
  }

  const handleUserStoryDelete = (index: number) => {
    const newStories = localUserStories.filter((_, i) => i !== index);
    setLocalUserStories(newStories);
  }

  const handleAddUserStory = () => {
    setLocalUserStories([
      ...localUserStories,
      { role: "User", feature: "New Feature", benefit: "Benefit", story: "As a User, I want New Feature so that Benefit." }
    ])
  }


  return (
    <section ref={sectionRef} className="py-12 sm:py-16">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6 animate-on-scroll opacity-0">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary animate-pulse-glow">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Analysis Complete</p>
                <p className="text-sm text-muted-foreground">
                  I&apos;ve analyzed your requirements and extracted the following insights:
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveChanges} disabled={isSaving} className="min-w-[100px]">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save New Version"}
                  </Button>
                </>
              ) : (
                <Button onClick={() => setIsEditing(true)} variant="outline">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Requirements
                </Button>
              )}
            </div>
          </div>

          <Tabs defaultValue="overview" className="w-full animate-on-scroll opacity-0 delay-200">
            <ScrollArea className="w-full">
              <TabsList className="inline-flex w-max mb-6 bg-secondary">
                <TabsTrigger value="overview" className="transition-all duration-200">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="functional" className="transition-all duration-200">
                  Functional
                </TabsTrigger>
                <TabsTrigger value="non-functional" className="transition-all duration-200">
                  Non-Functional
                </TabsTrigger>
                <TabsTrigger value="entities" className="transition-all duration-200">
                  Entities
                </TabsTrigger>
                <TabsTrigger value="stories" className="transition-all duration-200">
                  User Stories
                </TabsTrigger>
                <TabsTrigger value="acceptance" className="transition-all duration-200">
                  Acceptance
                </TabsTrigger>
                <TabsTrigger value="api" className="transition-all duration-200">
                  API Contracts
                </TabsTrigger>
                <TabsTrigger value="missing" className="transition-all duration-200">
                  Missing Logic
                </TabsTrigger>
                <TabsTrigger value="diagrams" className="transition-all duration-200">
                  Diagrams
                </TabsTrigger>
                <TabsTrigger value="code" className="transition-all duration-200">
                  Stack & Code
                </TabsTrigger>
                <TabsTrigger value="quality" className="transition-all duration-200">
                  Quality Audit
                </TabsTrigger>
              </TabsList>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6 animate-fade-in">
              <Card className="bg-card border-border transition-all duration-300 hover:border-primary/30">
                <CardHeader>
                  <CardTitle className="text-lg">Cleaned Requirements</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {cleanedRequirements || "No requirements processed yet."}
                  </p>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <Card className="bg-card border-border transition-all duration-300 hover:border-primary/30 hover:-translate-y-1">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      Identified Entities
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {entities.length > 0 ? (
                        entities.map((entity, index) => (
                          <Badge
                            key={entity}
                            variant="secondary"
                            className="bg-secondary transition-all duration-300 hover:scale-105 hover:bg-primary/20"
                            style={{ animationDelay: `${index * 50}ms` }}
                          >
                            {entity}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No entities identified.</span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border transition-all duration-300 hover:border-primary/30 hover:-translate-y-1">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      Missing Logic
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {missingLogic.length > 0 ? (
                        missingLogic.slice(0, 3).map((item, index) => (
                          <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-amber-500">•</span>
                            {item}
                          </li>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No missing logic detected.</span>
                      )}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {contradictions && contradictions.length > 0 && (
                <Card className="mt-6 bg-destructive/10 border-destructive transition-all duration-300 animate-pulse-glow hover:border-destructive/80">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                      <Bug className="h-5 w-5" />
                      AI Bug Detector: Critical Contradictions Found
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {contradictions.map((item, index) => (
                        <li key={index} className="flex items-start gap-3 text-sm font-medium text-destructive">
                          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Functional Requirements Tab */}
            <TabsContent value="functional" className="animate-fade-in">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Functional Requirements</CardTitle>
                </CardHeader>
                <CardContent>
                  <EditableSection
                    items={isEditing ? localFunctionalReqs : functionalRequirements}
                    isEditing={isEditing}
                    onUpdate={setLocalFunctionalReqs}
                    prefix="FR"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Non-Functional Requirements Tab */}
            <TabsContent value="non-functional" className="animate-fade-in">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Non-Functional Requirements</CardTitle>
                </CardHeader>
                <CardContent>
                  <EditableSection
                    items={isEditing ? localNonFunctionalReqs : nonFunctionalRequirements}
                    isEditing={isEditing}
                    onUpdate={setLocalNonFunctionalReqs}
                    prefix="NFR"
                    badgeColor="border-cyan-500/50 text-cyan-400"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Entities Tab */}
            <TabsContent value="entities" className="animate-fade-in">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Identified Entities</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {entities.length > 0 ? (
                      entities.map((entity, index) => (
                        <Badge
                          key={entity}
                          className="text-sm py-1.5 px-4 bg-primary/10 text-primary hover:bg-primary/20 transition-all duration-300 hover:scale-110 cursor-default"
                          style={{ animationDelay: `${index * 100}ms` }}
                        >
                          {entity}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">No entities identified.</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* User Stories Tab */}
            <TabsContent value="stories" className="animate-fade-in">
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(isEditing ? localUserStories : userStories).length > 0 ? (
                    (isEditing ? localUserStories : userStories).map((story, index) => (
                      <StoryCard
                        key={index}
                        {...story}
                        index={index}
                        isEditing={isEditing}
                        onUpdate={(updated) => handleUserStoryUpdate(index, updated)}
                        onDelete={() => handleUserStoryDelete(index)}
                      />
                    ))
                  ) : (
                    <div className="col-span-full text-center text-sm text-muted-foreground p-4">
                      No user stories generated.
                    </div>
                  )}
                </div>
                {isEditing && (
                  <Button variant="outline" onClick={handleAddUserStory} className="w-full border-dashed">
                    <Plus className="mr-2 h-4 w-4" />
                    Add User Story
                  </Button>
                )}
              </div>
            </TabsContent>

            {/* Acceptance Criteria Tab */}
            <TabsContent value="acceptance" className="space-y-4 animate-fade-in">
              {acceptanceCriteria.length > 0 ? (
                acceptanceCriteria.map((item, index) => (
                  <Card key={index} className="bg-card border-border transition-all duration-300 hover:border-primary/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{item.story}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {item.criteria.map((criterion, idx) => (
                          <li
                            key={idx}
                            className="text-sm text-muted-foreground flex items-start gap-2 transition-all duration-200 hover:text-foreground"
                          >
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                            {criterion}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center text-sm text-muted-foreground p-4">
                  No acceptance criteria generated.
                </div>
              )}
            </TabsContent>

            {/* API Contracts Tab */}
            <TabsContent value="api" className="space-y-4 animate-fade-in">
              {apiContracts.length > 0 ? (
                apiContracts.map((api, index) => (
                  <ApiCard key={index} {...api} index={index} />
                ))
              ) : (
                <div className="text-center text-sm text-muted-foreground p-4">
                  No API contracts generated.
                </div>
              )}
            </TabsContent>

            {/* Missing Logic Tab */}
            <TabsContent value="missing" className="animate-fade-in">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Missing Logic & Ambiguities
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {missingLogic.length > 0 ? (
                      missingLogic.map((item, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-3 text-sm transition-all duration-300 hover:translate-x-1"
                        >
                          <Badge variant="outline" className="shrink-0 mt-0.5 text-amber-500 border-amber-500/50">
                            #{index + 1}
                          </Badge>
                          {item}
                        </li>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">No missing logic detected.</span>
                    )}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Diagrams Tab */}
            <TabsContent value="diagrams" className="animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 overflow-scroll">
                <DiagramEditor
                  title="Flowchart"
                  initialCode={flowchartDiagram}
                  onSave={async (newCode) => {
                    try {
                      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${analysisId}`, {
                        method: "PUT",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify({ flowchartDiagram: newCode })
                      })

                      if (!res.ok) throw new Error("Failed to save diagram")

                      const updated = await res.json()
                      if (updated.id && updated.id !== analysisId) {
                        toast.success("New version created")
                        router.push(`/analysis/${updated.id}`)
                      } else {
                        toast.success("Diagram saved")
                        onRefresh?.()
                      }
                    } catch (e) {
                      toast.error("Failed to save flowchart")
                      console.error(e)
                    }
                  }}
                  onOpenChange={onDiagramEditChange}
                />
                <DiagramEditor
                  title="Sequence Diagram"
                  initialCode={sequenceDiagram}
                  onSave={async (newCode) => {
                    try {
                      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${analysisId}`, {
                        method: "PUT",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify({ sequenceDiagram: newCode })
                      })

                      if (!res.ok) throw new Error("Failed to save diagram")

                      const updated = await res.json()
                      if (updated.id && updated.id !== analysisId) {
                        toast.success("New version created")
                        router.push(`/analysis/${updated.id}`)
                      } else {
                        toast.success("Diagram saved")
                        onRefresh?.()
                      }
                    } catch (e) {
                      toast.error("Failed to save sequence diagram")
                      console.error(e)
                    }
                  }}
                  onOpenChange={onDiagramEditChange}
                />
              </div>
            </TabsContent>

            {/* Code Generator Tab */}
            <TabsContent value="code" className="animate-fade-in min-h-[500px]">
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

            {/* Quality Audit Tab */}
            <TabsContent value="quality" className="animate-fade-in">
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
                          <CheckCircle2 className="h-4 w-4" />
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
