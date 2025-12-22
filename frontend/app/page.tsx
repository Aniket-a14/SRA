"use client";

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Navbar } from "@/components/navbar"
import { HeroSection } from "@/components/hero-section"
import { ChatInput } from "@/components/chat-input"
import { ResultsTabs } from "@/components/results-tabs"
import { AboutSection } from "@/components/about-section"
import { FaqSection } from "@/components/faq-section"
import { Footer } from "@/components/footer"
import type { AnalysisResult } from "@/types/analysis"
import { toast } from "sonner"

const defaultAnalysis: AnalysisResult = {
  projectTitle: "Untitled Project",
  introduction: {
    purpose: "",
    scope: "",
    intendedAudience: "",
    documentConventions: "",
    references: []
  },
  overallDescription: {
    productPerspective: "",
    productFunctions: [],
    userClassesAndCharacteristics: [],
    operatingEnvironment: "",
    designAndImplementationConstraints: [],
    userDocumentation: [],
    assumptionsAndDependencies: []
  },
  externalInterfaceRequirements: {
    userInterfaces: "",
    hardwareInterfaces: "",
    softwareInterfaces: "",
    communicationsInterfaces: ""
  },
  systemFeatures: [],
  nonFunctionalRequirements: {
    performanceRequirements: [],
    safetyRequirements: [],
    securityRequirements: [],
    softwareQualityAttributes: [],
    businessRules: []
  },
  otherRequirements: [],
  glossary: [],
  appendices: {
    analysisModels: {},
    tbdList: []
  },
  missingLogic: [],
  contradictions: [],
}

import { fetchProject } from "@/lib/projects-api"
import { PromptSettings } from "@/types/project";
import { Folder } from "lucide-react"

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { authenticateWithToken, token } = useAuth()
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult>(defaultAnalysis)
  const [isLoading, setIsLoading] = useState(false)

  const projectId = searchParams.get("projectId")
  const [projectName, setProjectName] = useState<string>("")

  const [projectSettings, setProjectSettings] = useState<PromptSettings | null>(null);

  useEffect(() => {
    const urlToken = searchParams.get("token")
    const urlRefreshToken = searchParams.get("refreshToken")
    if (urlToken) {
      authenticateWithToken(urlToken, urlRefreshToken || undefined)
    }
  }, [searchParams, authenticateWithToken])

  useEffect(() => {
    if (projectId && token) {
      fetchProject(token, projectId).then(p => {
        setProjectName(p.name);
        if (p.settings) setProjectSettings(p.settings);
      }).catch(() => setProjectName("Unknown Project"));
    }
  }, [projectId, token])

  const handleAnalyze = async (requirements: string, settings: PromptSettings) => {
    setIsLoading(true)
    try {
      // LAYER 1 TRANSITION: Create Draft instead of immediate analysis
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          // Map single input to Draft Data
          srsData: {
            introduction: {
              purpose: { content: requirements }
            }
          },
          projectId: projectId || undefined,
          settings: settings || undefined,
          draft: true // Signal to backend to create draft only
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to start project")
      }

      const data = await response.json()

      // Redirect to Layer 1 (Input Phase)
      if (data.status === 'draft' && data.id) {
        toast.success("Project initialized! Proceeding to Structured Input.");
        router.push(`/analysis/${data.id}`);
        return;
      }

      // Fallback for unexpected states (should not reach here with draft:true)
      setAnalysisResult(data.result);

    } catch (error) {
      console.error("Error starting project:", error)
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
      toast.error(errorMessage);
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <HeroSection />

        {projectId && (
          <div className="container mx-auto px-4 mt-6 mb-2">
            <div className="bg-primary/10 border border-primary/20 text-primary px-4 py-3 rounded-md flex items-center gap-2">
              <Folder size={18} />
              <span className="font-medium">Analysis Context: <strong>{projectName || "Loading..."}</strong></span>
            </div>
          </div>
        )}

        <ChatInput onAnalyze={handleAnalyze} isLoading={isLoading} initialSettings={projectSettings || undefined} />
        <ResultsTabs data={analysisResult} />
        <AboutSection />
        <FaqSection />
      </main>
      <Footer />
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <HomeContent />
    </Suspense>
  )
}
