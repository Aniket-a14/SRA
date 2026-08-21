import { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
    icon: LucideIcon
    heading: string
    description?: string
    cta?: { label: string; onClick: () => void }
    /** Swaps the icon tile to the destructive palette for an error (vs. plain empty-list) state. */
    variant?: "empty" | "error"
}

/** Shared "nothing to show" treatment — icon + heading + description + optional CTA. */
export function EmptyState({ icon: Icon, heading, description, cta, variant = "empty" }: EmptyStateProps) {
    return (
        <div className="text-center py-12">
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-full mb-4 ${variant === "error" ? "bg-destructive/10" : "bg-muted"}`}>
                <Icon className={`h-6 w-6 ${variant === "error" ? "text-destructive" : "text-muted-foreground"}`} />
            </div>
            <h3 className="text-lg font-medium">{heading}</h3>
            {description && (
                <p className="text-muted-foreground mt-2 max-w-sm mx-auto">{description}</p>
            )}
            {cta && (
                <Button onClick={cta.onClick} className="mt-5 gap-2 rounded-lg bg-foreground text-background hover:bg-foreground/90">
                    {cta.label}
                </Button>
            )}
        </div>
    )
}
