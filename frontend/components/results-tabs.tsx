"use client"

import React, { useEffect, useRef, useState, memo } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Bot } from "lucide-react"
import type { Analysis, AnalysisResult } from "@/types/analysis"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { throttle } from "@/lib/utils"
import { useAuthFetch } from "@/lib/hooks"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"

// Modular Tab Components
import dynamic from "next/dynamic"

const IntroductionTab = dynamic(() => import("./analysis/tabs/introduction-tab").then(mod => mod.IntroductionTab))
const FeaturesTab = dynamic(() => import("./analysis/tabs/features-tab").then(mod => mod.FeaturesTab))
const InterfacesTab = dynamic(() => import("./analysis/tabs/interfaces-tab").then(mod => mod.InterfacesTab))
const NFRsTab = dynamic(() => import("./analysis/tabs/nfrs-tab").then(mod => mod.NFRsTab))
const AppendicesTab = dynamic(() => import("./analysis/tabs/appendices-tab").then(mod => mod.AppendicesTab))
const CodeAssetsTab = dynamic(() => import("./analysis/tabs/code-assets-tab").then(mod => mod.CodeAssetsTab))
const QualityAuditTab = dynamic(() => import("./analysis/tabs/quality-audit-tab").then(mod => mod.QualityAuditTab))
const KnowledgeGraphTab = dynamic(() => import("./analysis/tabs/knowledge-graph-tab").then(mod => mod.KnowledgeGraphTab))
import type { CodeViewerProps } from "./code-viewer"

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

  if (!data) return null

  const currentData = isEditing && editedData ? editedData : data

  return (
    <section ref={sectionRef} className="py-12 sm:py-16">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8 animate-on-scroll opacity-0">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary animate-pulse-glow shadow-lg shadow-primary/20">
                <Bot className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight mb-1">Analysis Report</h2>
                <p className="text-muted-foreground">
                  IEEE 830-1998 Compliant Software Requirements Specification
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" onClick={() => {
                    setIsEditing(false)
                    setEditedData(data ? structuredClone(data) : null)
                  }}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave}>
                    Save Changes
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  Edit Requirements
                </Button>
              )}
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
                <TabsTrigger value="graph" className="px-4 py-2">Knowledge Graph</TabsTrigger>
                <TabsTrigger value="quality" className="px-4 py-2">Quality Audit</TabsTrigger>
              </TabsList>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            <TabsContent value="intro" className="outline-none">
              <IntroductionTab
                introduction={currentData.introduction}
                overallDescription={currentData.overallDescription}
                missingLogic={currentData.missingLogic}
                contradictions={currentData.contradictions}
                isEditing={isEditing}
                onUpdate={updateSection}
              />
            </TabsContent>

            <TabsContent value="features" className="outline-none">
              <FeaturesTab
                systemFeatures={currentData.systemFeatures}
                projectTitle={data.projectTitle}
                isEditing={isEditing}
                onUpdate={updateSection}
              />
            </TabsContent>

            <TabsContent value="interfaces" className="outline-none">
              <InterfacesTab
                externalInterfaceRequirements={currentData.externalInterfaceRequirements}
                isEditing={isEditing}
                onUpdate={updateSection}
              />
            </TabsContent>

            <TabsContent value="nfrs" className="outline-none">
              <NFRsTab
                nonFunctionalRequirements={currentData.nonFunctionalRequirements}
                otherRequirements={currentData.otherRequirements}
                projectTitle={data.projectTitle}
                isEditing={isEditing}
                onUpdate={updateSection}
              />
            </TabsContent>

            <TabsContent value="appendices" className="outline-none">
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
            </TabsContent>

            <TabsContent value="code" className="outline-none">
              <CodeAssetsTab
                initialGeneratedCode={data.generatedCode as unknown as CodeViewerProps}
                analysisId={analysisId}
              />
            </TabsContent>

            <TabsContent value="quality" className="outline-none">
              <QualityAuditTab qualityAudit={currentData.qualityAudit} />
            </TabsContent>

            <TabsContent value="graph" className="outline-none">
              <KnowledgeGraphTab projectId={data.projectId || ""} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
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


