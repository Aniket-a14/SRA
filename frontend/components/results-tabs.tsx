"use client"

import { useEffect, useRef } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { StoryCard } from "@/components/story-card"
import { ApiCard } from "@/components/api-card"
import { MermaidRenderer } from "@/components/mermaid-renderer"
import { CheckCircle2, AlertTriangle, Bot } from "lucide-react"
import type { AnalysisResult } from "@/types/analysis"

interface ResultsTabsProps {
  data?: AnalysisResult
}

export function ResultsTabs({ data }: ResultsTabsProps) {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-fade-up")
          }
        })
      },
      { threshold: 0.05 },
    )

    const elements = sectionRef.current?.querySelectorAll(".animate-on-scroll")
    elements?.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])

  if (!data) {
    return null
  }

  const {
    cleanedRequirements,
    functionalRequirements,
    nonFunctionalRequirements,
    entities,
    userStories,
    acceptanceCriteria,
    apiContracts,
    missingLogic,
    flowchartDiagram,
    sequenceDiagram,
  } = data

  return (
    <section ref={sectionRef} className="py-12 sm:py-16">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start gap-3 mb-6 animate-on-scroll opacity-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary animate-pulse-glow">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Analysis Complete</p>
              <p className="text-sm text-muted-foreground">
                I've analyzed your requirements and extracted the following insights:
              </p>
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
            </TabsContent>

            {/* Functional Requirements Tab */}
            <TabsContent value="functional" className="animate-fade-in">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Functional Requirements</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {functionalRequirements.length > 0 ? (
                      functionalRequirements.map((req, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-3 transition-all duration-300 hover:translate-x-1"
                        >
                          <Badge variant="outline" className="shrink-0 mt-0.5 border-primary/50 text-primary">
                            FR-{String(index + 1).padStart(2, "0")}
                          </Badge>
                          <span className="text-sm">{req}</span>
                        </li>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">No functional requirements found.</span>
                    )}
                  </ul>
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
                  <ul className="space-y-3">
                    {nonFunctionalRequirements.length > 0 ? (
                      nonFunctionalRequirements.map((req, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-3 transition-all duration-300 hover:translate-x-1"
                        >
                          <Badge variant="outline" className="shrink-0 mt-0.5 border-cyan-500/50 text-cyan-400">
                            NFR-{String(index + 1).padStart(2, "0")}
                          </Badge>
                          <span className="text-sm">{req}</span>
                        </li>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">No non-functional requirements found.</span>
                    )}
                  </ul>
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
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {userStories.length > 0 ? (
                  userStories.map((story, index) => (
                    <StoryCard key={index} {...story} index={index} />
                  ))
                ) : (
                  <div className="col-span-full text-center text-sm text-muted-foreground p-4">
                    No user stories generated.
                  </div>
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <MermaidRenderer title="Flowchart" chart={flowchartDiagram} />
                <MermaidRenderer title="Sequence Diagram" chart={sequenceDiagram} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </section>
  )
}
