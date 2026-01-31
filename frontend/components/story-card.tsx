import { memo } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { UserStory } from "@/types/analysis"
import { Button } from "./ui/button"
import { Trash2 } from "lucide-react"

interface StoryCardProps extends UserStory {
  index?: number
  isEditing?: boolean
  onUpdate?: (updatedStory: UserStory) => void
  onDelete?: () => void
}

export const StoryCard = memo(function StoryCard({ role, feature, benefit, story, index = 0, isEditing = false, onUpdate, onDelete }: StoryCardProps) {

  const handleChange = (field: keyof UserStory, value: string) => {
    if (onUpdate) {
      onUpdate({ role, feature, benefit, story, [field]: value })
    }
  }

  if (isEditing) {
    return (
      <Card className="bg-card border-border relative group">
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10 h-6 w-6"
          aria-label="Delete user story"
        >
          <Trash2 className="h-3 w-3" aria-hidden="true" />
        </Button>
        <CardContent className="space-y-3 pt-6">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">As a...</Label>
            <Input
              value={role}
              onChange={(e) => handleChange("role", e.target.value)}
              placeholder="Role"
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">I want to...</Label>
            <Input
              value={feature}
              onChange={(e) => handleChange("feature", e.target.value)}
              placeholder="Feature"
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">So that...</Label>
            <Input
              value={benefit}
              onChange={(e) => handleChange("benefit", e.target.value)}
              placeholder="Benefit"
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Full Story</Label>
            <Textarea
              value={story}
              onChange={(e) => handleChange("story", e.target.value)}
              placeholder="Full User Story"
              className="min-h-[80px]"
            />
          </div>
        </CardContent>
      </Card>
    )
  }

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
});

