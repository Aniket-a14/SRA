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
  cleanedRequirements: "",
  functionalRequirements: [],
  nonFunctionalRequirements: [],
  entities: [],
  userStories: [],
  acceptanceCriteria: [],
  flowchartDiagram: "",
  sequenceDiagram: "",
  apiContracts: [],
  missingLogic: [],
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
    if (urlToken) {
      authenticateWithToken(urlToken)
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: requirements,
          projectId: projectId || undefined,
          settings: settings || undefined
        }),
      })

      if (!response.ok) {
        throw new Error("Analysis failed")
      }

      const data = await response.json()

      // Handle Async Job Queue
      if (response.status === 202 && data.jobId) {
        toast.info("Analysis queued. Please wait...");
        // Poll for completion
        const poll = async () => {
          const statusRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/job/${data.jobId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const statusData = await statusRes.json();

          if (statusData.state === 'completed' && statusData.result) {
            setAnalysisResult(statusData.result.resultJson);
            toast.success("Analysis complete!");
            setIsLoading(false);
            // Scroll to results
            document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });

            // If in project mode, redirect back to project after short delay or show option
            if (projectId) {
              toast.success(`Saved to project: ${projectName}`);
            }

          } else if (statusData.state === 'failed') {
            setIsLoading(false);
            toast.error(`Analysis failed: ${statusData.error}`);
          } else {
            // Continue polling
            setTimeout(poll, 2000);
          }
        };
        poll();
      } else {
        // Fallback for synchronous (should not happen with new backend)
        setAnalysisResult(data.result);
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error analyzing requirements:", error)
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
      router.push(`/error?message=${encodeURIComponent(errorMessage)}`)
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
