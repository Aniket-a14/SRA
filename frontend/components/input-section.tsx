"use client"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Sparkles } from "lucide-react"

export function InputSection() {
  return (
    <section className="w-full max-w-3xl mx-auto text-center space-y-6">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight text-balance">Smart Requirements Analyzer</h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto text-pretty">
          Transform raw requirements into structured insights. Get functional specs, user stories, API contracts, and
          visual diagrams instantly.
        </p>
      </div>

      <div className="space-y-4">
        <Textarea
          placeholder="Paste your requirements here... (e.g., 'Users should be able to register with email and password. Admin can manage all users and view reports.')"
          className="min-h-[180px] text-base resize-none"
        />
        <Button size="lg" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Analyze Requirements
        </Button>
      </div>
    </section>
  )
}
