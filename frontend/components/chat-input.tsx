"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Sparkles } from "lucide-react"

interface ChatInputProps {
  onAnalyze: (requirements: string) => void
  isLoading: boolean
}

export function ChatInput({ onAnalyze, isLoading }: ChatInputProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const [input, setInput] = useState("")

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-scale-in")
          }
        })
      },
      { threshold: 0.1 },
    )

    const elements = sectionRef.current?.querySelectorAll(".animate-on-scroll")
    elements?.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && !isLoading) {
        onAnalyze(input)
      }
    }
  }

  return (
    <section id="analyzer" ref={sectionRef} className="py-10 sm:py-14">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8 animate-on-scroll opacity-0">
            <h2 className="text-xl sm:text-2xl font-semibold mb-2">Start Analyzing</h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              Paste your requirements below and let AI do the heavy lifting
            </p>
          </div>

          <Card className="p-3 sm:p-4 bg-card border-border animate-on-scroll opacity-0 delay-200 transition-all duration-500 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10">
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 animate-pulse-glow">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-3">
                    Hello! I can help you analyze requirements. Paste your project requirements and I&apos;ll extract
                    functional specs, user stories, entities, and more.
                  </p>
                </div>
              </div>

              <div className="relative group">
                <Textarea
                  placeholder="Paste your requirements here... (e.g., 'Users should be able to register with email and password. Admin can manage all users and view reports.')"
                  className="min-h-[120px] sm:min-h-[140px] resize-none bg-secondary border-0 pr-12 text-sm placeholder:text-muted-foreground/60 transition-all duration-300 focus:ring-2 focus:ring-primary/50"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                />
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground order-2 sm:order-1">
                  Press Enter to send, Shift+Enter for new line
                </p>
                <Button
                  className="gap-2 bg-primary hover:bg-primary/90 w-full sm:w-auto order-1 sm:order-2 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-primary/25"
                  onClick={() => onAnalyze(input)}
                  disabled={isLoading || !input.trim()}
                >
                  <Sparkles className="h-4 w-4" />
                  {isLoading ? "Analyzing..." : "Analyze Requirements"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  )
}
