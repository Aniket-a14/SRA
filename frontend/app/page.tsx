"use client";

import { useState, useEffect, Suspense, useActionState, startTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Navbar } from "@/components/navbar"
import { HeroSection } from "@/components/hero-section"
import { ChatInput } from "@/components/chat-input"
import { ResultsTabs } from "@/components/results-tabs"
import { AboutSection } from "@/components/about-section"
import { FaqSection } from "@/components/faq-section"
import { Footer } from "@/components/footer"
import type { Analysis } from "@/types/analysis"
import { toast } from "sonner"
import { createAnalysisAction } from "@/actions/analysis"

const defaultAnalysis: Analysis = {
  id: "preview",
  userId: "preview",
  status: "COMPLETED",
  version: 1,
  createdAt: new Date().toISOString(),
  rootId: "preview",
  parentId: null,
  projectTitle: "Untitled Project",
  introduction: {
    purpose: "",
    productScope: "",
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
  const [analysisResult, setAnalysisResult] = useState<Analysis>(defaultAnalysis)

  const [state, formAction, isPending] = useActionState(createAnalysisAction, {});

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

  // Handle Action State changes
  useEffect(() => {
    if (state.error) {
      toast.error(state.error);
    }
    if (state.success && state.id) {
      toast.success("Project initialized! Proceeding to Structured Input.");
      router.push(`/analysis/${state.id}`);
    }
  }, [state, router]);

  const handleAnalyze = async (requirements: string, settings: PromptSettings, name: string) => {
    if (!token) {
      toast.error("You must be logged in to start a project.");
      return;
    }

    const formData = new FormData();
    formData.append("token", token);
    formData.append("requirements", requirements);
    formData.append("projectName", name);
    if (projectId) formData.append("projectId", projectId);
    formData.append("settings", JSON.stringify(settings));

    startTransition(() => {
      formAction(formData);
    });
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

        <ChatInput onAnalyze={handleAnalyze} isLoading={isPending} initialSettings={projectSettings || undefined} />
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
