"use client"

import React, { useEffect, useRef, useState, memo } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Analysis, AnalysisResult } from "@/types/analysis"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { throttle } from "@/lib/utils"
import { useAuthFetch } from "@/lib/hooks"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { ErrorBoundary } from "@/components/error-boundary"

// Modular Tab Components — all dynamic so a syntax/render error or heavy dependency
// (e.g. MermaidRenderer/DFDViewer inside AppendicesTab) in one tab's bundle can't
// block the others from loading, and each gets its own ErrorBoundary below so a
// crash while rendering one tab doesn't take down the other 7.
import dynamic from "next/dynamic"

const tabLoading = <div className="h-[400px] w-full bg-muted/10 animate-pulse rounded-xl" />

const IntroductionTab = dynamic(() => import("./analysis/tabs/introduction-tab").then(mod => mod.IntroductionTab), { loading: () => tabLoading })
const FeaturesTab = dynamic(() => import("./analysis/tabs/features-tab").then(mod => mod.FeaturesTab), { loading: () => tabLoading })
const InterfacesTab = dynamic(() => import("./analysis/tabs/interfaces-tab").then(mod => mod.InterfacesTab), { loading: () => tabLoading })
const NFRsTab = dynamic(() => import("./analysis/tabs/nfrs-tab").then(mod => mod.NFRsTab), { loading: () => tabLoading })
const AppendicesTab = dynamic(() => import("./analysis/tabs/appendices-tab").then(mod => mod.AppendicesTab), { loading: () => tabLoading })
const KnowledgeGraphTab = dynamic(() => import("./analysis/tabs/knowledge-graph-tab").then(mod => mod.KnowledgeGraphTab), { loading: () => tabLoading })

interface ResultsTabsProps {
  data?: Analysis
  onDiagramEditChange?: (isEditing: boolean) => void
  onRefresh?: () => void
}

export const ResultsTabs = memo(function ResultsTabs({ data, onDiagramEditChange, onRefresh }: ResultsTabsProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const authFetch = useAuthFetch()
  const router = useRouter()
  const params = useParams()
  const analysisId = params?.id as string

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false)
  const [editedData, setEditedData] = useState<AnalysisResult | null>(null)

  // Initialize editedData when data changes or edit mode starts
  const lastDataIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (data && (!isEditing || analysisId !== lastDataIdRef.current)) {
      setEditedData(structuredClone(data))
      lastDataIdRef.current = analysisId;
    }
  }, [data, isEditing, analysisId])

  const handleSave = throttle(async () => {
    if (!editedData) return

    // Validation
    const errors: string[] = []
    if (!editedData.introduction?.purpose) errors.push("1.1 Purpose is required")
    if (!editedData.introduction?.productScope) errors.push("1.2 Product Scope is required")
    if (!editedData.overallDescription?.productPerspective) errors.push("2.1 Product Perspective is required")
    if (!editedData.overallDescription?.productFunctions || editedData.overallDescription.productFunctions.length === 0) errors.push("2.2 Product Functions are required")
    if (!editedData.overallDescription?.userClassesAndCharacteristics || editedData.overallDescription.userClassesAndCharacteristics.length === 0) errors.push("2.3 User Classes and Characteristics are required")
    if (!editedData.overallDescription?.designAndImplementationConstraints || editedData.overallDescription.designAndImplementationConstraints.length === 0) errors.push("2.4 Design and Implementation Constraints are required")
    if (!editedData.overallDescription?.userDocumentation || editedData.overallDescription.userDocumentation.length === 0) errors.push("2.5 User Documentation is required")
    if (!editedData.overallDescription?.assumptionsAndDependencies || editedData.overallDescription.assumptionsAndDependencies.length === 0) errors.push("2.6 Assumptions and Dependencies are required")

    if (!editedData.externalInterfaceRequirements?.userInterfaces) errors.push("3.1 User Interfaces is required")
    if (!editedData.externalInterfaceRequirements?.hardwareInterfaces) errors.push("3.2 Hardware Interfaces is required")
    if (!editedData.externalInterfaceRequirements?.softwareInterfaces) errors.push("3.3 Software Interfaces is required")
    if (!editedData.externalInterfaceRequirements?.communicationsInterfaces) errors.push("3.4 Communication Interfaces is required")

    if (!editedData.systemFeatures || editedData.systemFeatures.length === 0) errors.push("System Features are required")

    if (errors.length > 0) {
      toast.error("Please fill in all compulsory fields: \n" + errors.slice(0, 3).join(", ") + (errors.length > 3 ? "..." : ""))
      return
    }

    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${analysisId}`, {
        method: "PUT",
        body: JSON.stringify({
          ...editedData,
          skipAlignment: true
        })
      })

      if (!res.ok) throw new Error("Failed to save changes")

      const json = await res.json();
      const updated = json.data || json;
      toast.success("Changes saved successfully")
      setIsEditing(false)

      if (updated.id && updated.id !== analysisId) {
        router.push(`/analysis/${updated.id}`)
      } else {
        onRefresh?.()
      }
    } catch (error) {
      console.error(error)
      toast.error("Failed to save changes")
    }
  }, 2000)

  const updateSection = (section: keyof AnalysisResult, value: unknown) => {
    if (!editedData) return
    setEditedData(prev => prev ? ({ ...prev, [section]: value }) : null)
  }

  // Intersection observer removed for better tab performance

  if (!data) return null

  const currentData = isEditing && editedData ? editedData : data

  const tabTriggerClass = "group/tab flex-none flex items-center gap-2 rounded-none border-0 border-b-2 border-transparent bg-transparent shadow-none px-1 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
  const tabIndexClass = "font-mono text-[10px] text-muted-foreground/50 group-data-[state=active]/tab:text-foreground/70 transition-colors"

  return (
    <section ref={sectionRef} className="pb-10">
      <Tabs defaultValue="intro" className="w-full gap-0">
        {/* Editorial masthead + sticky underline nav. The eyebrow carries the standard,
            the serif line the section identity — matching the landing page's language. */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-foreground/10">
          <div className="flex items-end justify-between gap-3 px-4 sm:px-6 pt-4 pb-1">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/70">
                <span className="w-6 h-px bg-foreground/30" />
                IEEE 830-1998
              </span>
              <p className="font-display text-2xl leading-tight mt-1 hidden sm:block">Specification</p>
            </div>
            <div className="flex gap-2 ml-auto pb-1">
              {isEditing ? (
                <>
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {
                    setIsEditing(false)
                    setEditedData(data ? structuredClone(data) : null)
                  }}>
                    Cancel
                  </Button>
                  <Button size="sm" className="h-8 text-xs rounded-full bg-foreground text-background hover:bg-foreground/90" onClick={handleSave}>
                    Save changes
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" className="h-8 text-xs rounded-full border-foreground/20 hover:bg-foreground/5" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
              )}
            </div>
          </div>

          <ScrollArea className="w-full">
            <TabsList className="inline-flex w-max items-center justify-start gap-6 bg-transparent p-0 px-4 sm:px-6 h-auto rounded-none border-0">
              <TabsTrigger value="intro" className={tabTriggerClass}><span className={tabIndexClass}>01</span> Introduction</TabsTrigger>
              <TabsTrigger value="features" className={tabTriggerClass}><span className={tabIndexClass}>02</span> System Features</TabsTrigger>
              <TabsTrigger value="interfaces" className={tabTriggerClass}><span className={tabIndexClass}>03</span> Interfaces</TabsTrigger>
              <TabsTrigger value="nfrs" className={tabTriggerClass}><span className={tabIndexClass}>04</span> Non-Functional</TabsTrigger>
              <TabsTrigger value="appendices" className={tabTriggerClass}><span className={tabIndexClass}>05</span> Appendices</TabsTrigger>
              <TabsTrigger value="graph" className={tabTriggerClass}><span className={tabIndexClass}>06</span> Knowledge Graph</TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" className="opacity-0" />
          </ScrollArea>
        </div>

        <div className="px-4 sm:px-6 pt-6">
            <TabsContent value="intro" className="outline-none">
              <ErrorBoundary name="Introduction Tab">
                <IntroductionTab
                  introduction={currentData.introduction}
                  overallDescription={currentData.overallDescription}
                  revisionHistory={currentData.revisionHistory}
                  missingLogic={currentData.missingLogic}
                  contradictions={currentData.contradictions}
                  isEditing={isEditing}
                  onUpdate={updateSection}
                />
              </ErrorBoundary>
            </TabsContent>

            <TabsContent value="features" className="outline-none">
              <ErrorBoundary name="System Features Tab">
                <FeaturesTab
                  systemFeatures={currentData.systemFeatures}
                  projectTitle={data.projectTitle}
                  isEditing={isEditing}
                  onUpdate={updateSection}
                />
              </ErrorBoundary>
            </TabsContent>

            <TabsContent value="interfaces" className="outline-none">
              <ErrorBoundary name="External Interfaces Tab">
                <InterfacesTab
                  externalInterfaceRequirements={currentData.externalInterfaceRequirements}
                  isEditing={isEditing}
                  onUpdate={updateSection}
                />
              </ErrorBoundary>
            </TabsContent>

            <TabsContent value="nfrs" className="outline-none">
              <ErrorBoundary name="Non-Functional Requirements Tab">
                <NFRsTab
                  nonFunctionalRequirements={currentData.nonFunctionalRequirements}
                  otherRequirements={currentData.otherRequirements}
                  projectTitle={data.projectTitle}
                  isEditing={isEditing}
                  onUpdate={updateSection}
                />
              </ErrorBoundary>
            </TabsContent>

            <TabsContent value="appendices" className="outline-none">
              <ErrorBoundary name="Appendices Tab">
                <AppendicesTab
                  appendices={currentData.appendices}
                  glossary={currentData.glossary}
                  analysisId={analysisId}
                  projectTitle={data.projectTitle}
                  productScope={currentData.introduction?.productScope}
                  srsContent={JSON.stringify(data)}
                  onRefresh={onRefresh}
                  onDiagramEditChange={onDiagramEditChange}
                />
              </ErrorBoundary>
            </TabsContent>

            <TabsContent value="graph" className="outline-none">
              <ErrorBoundary name="Knowledge Graph Tab">
                <KnowledgeGraphTab projectId={data.projectId || ""} />
              </ErrorBoundary>
            </TabsContent>
        </div>
      </Tabs>
    </section>
  )
}, (prev, next) => {
  if (prev.onDiagramEditChange !== next.onDiagramEditChange) return false;
  if (prev.onRefresh !== next.onRefresh) return false;

  const p = prev.data;
  const n = next.data;

  if (!p || !n) return p === n;

  return p.id === n.id &&
    p.status === n.status &&
    p.isFinalized === n.isFinalized &&
    JSON.stringify(p.metadata) === JSON.stringify(n.metadata) &&
    p.version === n.version;
});
