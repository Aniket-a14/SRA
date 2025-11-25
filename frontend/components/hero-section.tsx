"use client"

import { useEffect, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { ArrowDown, Zap, FileText, Code2 } from "lucide-react"

export function HeroSection() {
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
      { threshold: 0.1 },
    )

    const elements = sectionRef.current?.querySelectorAll(".animate-on-scroll")
    elements?.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])

  return (
    <section id="home" ref={sectionRef} className="relative py-16 md:py-24 lg:py-32 overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float delay-500" />
      </div>

      <div className="container mx-auto px-4 text-center">
        <Badge
          variant="outline"
          className="mb-6 border-primary/50 text-primary animate-on-scroll opacity-0 transition-all duration-500 hover:scale-105"
        >
          AI-Powered Analysis
        </Badge>

        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 text-balance animate-on-scroll opacity-0 delay-100">
          Smart Requirements
          <span className="block text-primary mt-2">Analyzer</span>
        </h1>

        <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 text-pretty animate-on-scroll opacity-0 delay-200 px-4">
          Transform raw requirements into structured insights. Get functional specs, user stories, API contracts, and
          visual diagrams instantly.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mb-16 animate-on-scroll opacity-0 delay-300">
          {[
            { icon: Zap, label: "Instant Analysis" },
            { icon: FileText, label: "User Stories" },
            { icon: Code2, label: "API Contracts" },
          ].map((item, index) => (
            <div
              key={item.label}
              className="flex items-center gap-2 text-sm text-muted-foreground px-4 py-2 rounded-full bg-secondary/50 transition-all duration-300 hover:bg-secondary hover:scale-105"
            >
              <item.icon className="h-4 w-4 text-primary" />
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        <a
          href="#analyzer"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-all duration-300 group animate-on-scroll opacity-0 delay-400"
        >
          Try it now
          <ArrowDown className="h-4 w-4 animate-bounce group-hover:translate-y-1 transition-transform" />
        </a>
      </div>
    </section>
  )
}
