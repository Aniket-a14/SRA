"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, ChevronRight } from "lucide-react"

interface ApiCardProps {
  endpoint: string
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  description: string
  requestBody?: Record<string, any> | string
  responseBody?: Record<string, any> | string
  index?: number
}

const methodColors: Record<string, string> = {
  GET: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  POST: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  PUT: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  DELETE: "bg-red-500/20 text-red-400 border-red-500/30",
  PATCH: "bg-orange-500/20 text-orange-400 border-orange-500/30",
}

export function ApiCard({ endpoint, method, description, requestBody, responseBody, index = 0 }: ApiCardProps) {
  const [requestOpen, setRequestOpen] = useState(false)
  const [responseOpen, setResponseOpen] = useState(false)

  const formatBody = (body: Record<string, any> | string) => {
    if (typeof body === "string") return body
    return JSON.stringify(body, null, 2)
  }

  return (
    <Card
      className="bg-card border-border transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start sm:items-center gap-3 flex-col sm:flex-row">
          <Badge
            className={`${methodColors[method]} font-mono text-xs transition-transform duration-300 hover:scale-105`}
            variant="outline"
          >
            {method}
          </Badge>
          <CardTitle className="text-sm font-mono text-foreground break-all">{endpoint}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{description}</p>

        {requestBody && (
          <Collapsible open={requestOpen} onOpenChange={setRequestOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 h-8 px-2 text-muted-foreground hover:text-foreground transition-all duration-200"
              >
                <span className={`transition-transform duration-200 ${requestOpen ? "rotate-0" : ""}`}>
                  {requestOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </span>
                Request Body
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="animate-fade-in">
              <pre className="mt-2 p-3 bg-secondary rounded-md text-xs font-mono overflow-x-auto text-foreground">
                {formatBody(requestBody)}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        )}

        {responseBody && (
          <Collapsible open={responseOpen} onOpenChange={setResponseOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 h-8 px-2 text-muted-foreground hover:text-foreground transition-all duration-200"
              >
                <span className={`transition-transform duration-200 ${responseOpen ? "rotate-0" : ""}`}>
                  {responseOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </span>
                Response Body
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="animate-fade-in">
              <pre className="mt-2 p-3 bg-secondary rounded-md text-xs font-mono overflow-x-auto text-foreground">
                {formatBody(responseBody)}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  )
}
