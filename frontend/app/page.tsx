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
      setAnalysisResult(data.result)
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
