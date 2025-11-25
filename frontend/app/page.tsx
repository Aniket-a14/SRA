"use client";

import { useState } from "react"
import { useRouter } from "next/navigation"
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

export default function HomePage() {
  const router = useRouter()
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult>(defaultAnalysis)
  const [isLoading, setIsLoading] = useState(false)

  const handleAnalyze = async (requirements: string) => {
    setIsLoading(true)
    try {
      const response = await fetch("http://localhost:3000/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: requirements }),
      })

      if (!response.ok) {
        throw new Error("Analysis failed")
      }

      const data = await response.json()
      setAnalysisResult(data)
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
