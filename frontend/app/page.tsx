"use client";

import { useState } from "react"
import { Navbar } from "@/components/navbar"
import { HeroSection } from "@/components/hero-section"
import { ChatInput } from "@/components/chat-input"
import { ResultsTabs } from "@/components/results-tabs"
import { AboutSection } from "@/components/about-section"
import { FaqSection } from "@/components/faq-section" // Added FAQ section import
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
      // You might want to add a toast notification here
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
