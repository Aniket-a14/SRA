"use client"

import * as React from "react"
import { ThumbsUp, ThumbsDown, Check, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export function DocsFeedback() {
    const [voted, setVoted] = React.useState<"up" | "down" | null>(null)

    const handleVote = (type: "up" | "down") => {
        setVoted(type)
        toast.success("Thank you for your feedback!")
    }

    return (
        <div className="my-10 p-5 border border-foreground/10 bg-muted/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-foreground">
                    <MessageSquare className="h-3.5 w-3.5 text-primary" />
                    Was this page helpful?
                </span>
                <p className="text-[11px] text-muted-foreground font-sans">
                    Help us improve the SRA enterprise documentation.
                </p>
            </div>

            <div className="flex items-center gap-2">
                {voted ? (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                        <Check className="h-4 w-4" />
                        <span>Feedback received</span>
                    </div>
                ) : (
                    <>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-xs gap-1.5 border-foreground/10 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                            onClick={() => handleVote("up")}
                        >
                            <ThumbsUp className="h-3.5 w-3.5" />
                            <span>Yes</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-xs gap-1.5 border-foreground/10 hover:bg-destructive/5 hover:text-destructive hover:border-destructive/20"
                            onClick={() => handleVote("down")}
                        >
                            <ThumbsDown className="h-3.5 w-3.5" />
                            <span>No</span>
                        </Button>
                    </>
                )}
            </div>
        </div>
    )
}
