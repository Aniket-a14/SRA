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

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { authenticateWithToken, token } = useAuth()
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult>(defaultAnalysis)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const urlToken = searchParams.get("token")
    if (urlToken) {
      authenticateWithToken(urlToken)
    }
  }, [searchParams, authenticateWithToken])

  const handleAnalyze = async (requirements: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: requirements }),
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
        <ChatInput onAnalyze={handleAnalyze} isLoading={isLoading} />
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
