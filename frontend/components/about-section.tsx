"use client"

import { useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { FileSearch, GitBranch, Code, MessageSquare } from "lucide-react"

const features = [
  {
    icon: FileSearch,
    title: "Requirement Extraction",
    description: "Automatically extract functional and non-functional requirements from raw text.",
  },
  {
    icon: MessageSquare,
    title: "User Stories",
    description: "Generate user stories with roles, features, and acceptance criteria.",
  },
  {
    icon: Code,
    title: "API Contracts",
    description: "Create API endpoint specifications with request/response schemas.",
  },
  {
    icon: GitBranch,
    title: "Diagram Generation",
    description: "Visualize use cases and sequences with auto-generated diagrams.",
  },
]

export function AboutSection() {
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
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" },
    )

    const elements = sectionRef.current?.querySelectorAll(".animate-on-scroll")
    elements?.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])

  return (
    <section id="about" ref={sectionRef} className="py-16 sm:py-20 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 animate-on-scroll opacity-0">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">How It Works</h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base px-4">
            Our AI-powered analyzer transforms your raw requirements into comprehensive, structured documentation in
            seconds.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 max-w-5xl mx-auto">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="bg-card border-border animate-on-scroll opacity-0 transition-all duration-500 hover:border-primary/50 hover:-translate-y-2 hover:shadow-xl hover:shadow-primary/10 group"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardContent className="pt-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4 transition-all duration-300 group-hover:bg-primary/20 group-hover:scale-110">
                  <feature.icon className="h-6 w-6 text-primary transition-transform duration-300 group-hover:rotate-6" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
