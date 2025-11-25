import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ImageIcon } from "lucide-react"

interface PlaceholderDiagramProps {
  title: string
}

export function PlaceholderDiagram({ title }: PlaceholderDiagramProps) {
  return (
    <Card className="h-56 sm:h-64 bg-card border-border transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 group">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-center h-[calc(100%-4rem)]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="p-4 rounded-lg bg-secondary border border-border transition-all duration-300 group-hover:border-primary/50 group-hover:scale-110 group-hover:bg-primary/10">
            <ImageIcon className="h-8 w-8 text-primary transition-transform duration-300 group-hover:rotate-6" />
          </div>
          <span className="text-sm">Diagram will appear here</span>
        </div>
      </CardContent>
    </Card>
  )
}
