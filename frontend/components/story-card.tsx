import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface StoryCardProps {
  role: string
  feature: string
  benefit: string
  story: string
  index?: number // Added index for staggered animation
}

export function StoryCard({ role, feature, benefit, story, index = 0 }: StoryCardProps) {
  return (
    <Card
      className="bg-card border-border transition-all duration-300 hover:border-primary/50 hover:-translate-y-2 hover:shadow-xl hover:shadow-primary/10 group"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <CardHeader className="pb-3">
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-105">
            {role}
          </Badge>
          <Badge variant="outline" className="border-border transition-transform duration-300 group-hover:scale-105">
            {feature}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-foreground">{story}</p>
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Benefit:</span> {benefit}
        </div>
      </CardContent>
    </Card>
  )
}
