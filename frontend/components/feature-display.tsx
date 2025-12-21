import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { SystemFeature } from "@/types/analysis"
import { getAcronym } from "@/lib/utils"
import { renderMarkdown } from "@/lib/render-markdown"

interface FeatureDisplayProps {
    features: SystemFeature[]
    projectTitle?: string
}

export function FeatureDisplay({ features, projectTitle = "SRA" }: FeatureDisplayProps) {
    const acronym = getAcronym(projectTitle);

    if (!features || features.length === 0) {
        return (
            <div className="text-center p-8 text-muted-foreground border border-dashed rounded-lg">
                No system features identified.
            </div>
        )
    }

    const renderDescription = (name: string, description: string) => {
        const cleanName = name.replace(/^\d+(\.\d+)*\s*/, '').trim();
        const prefix = `${cleanName}:`;
        if (description.startsWith(prefix)) {
            const rest = description.substring(prefix.length);
            return (
                <span>
                    <span className="font-bold text-foreground">{prefix}</span>{renderMarkdown(rest)}
                </span>
            );
        }
        return renderMarkdown(description);
    };

    return (
        <div className="space-y-6">
            {features.map((feature, index) => (
                <Card key={index} className="bg-card border-border transition-all duration-300 hover:border-primary/30">
                    <CardHeader className="pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <CardTitle className="text-lg font-semibold text-primary">
                                {feature.name}
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h4 className="text-sm font-medium mb-2 text-foreground/80">Description</h4>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {renderDescription(feature.name, feature.description)}
                            </p>
                        </div>

                        {feature.stimulusResponseSequences && feature.stimulusResponseSequences.length > 0 && (
                            <div>
                                <h4 className="text-sm font-medium mb-2 text-foreground/80">Stimulus/Response Sequences</h4>
                                <ul className="list-disc list-inside space-y-1">
                                    {feature.stimulusResponseSequences.map((seq, idx) => (
                                        <li key={idx} className="text-sm text-muted-foreground pl-2">
                                            <span className="-ml-2">{renderMarkdown(seq)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <Separator className="bg-border/50" />

                        <div>
                            <h4 className="text-sm font-medium mb-3 text-foreground/80">Functional Requirements</h4>
                            <div className="grid gap-2">
                                {feature.functionalRequirements && feature.functionalRequirements.length > 0 ? (
                                    feature.functionalRequirements.map((req, idx) => {
                                        // Strip existing ID if present to avoid double labeling
                                        const cleanReq = req.replace(/^[A-Z]+-[A-Z]+-\d+\s*:?\s*/, '').trim();
                                        return (
                                            <div
                                                key={idx}
                                                className="flex items-start gap-3 p-3 rounded-md bg-secondary/50 border border-border/50 transition-colors hover:bg-secondary/80"
                                            >
                                                <Badge variant="outline" className="shrink-0 mt-0.5 text-xs text-primary bg-primary/5 uppercase">
                                                    {acronym}-FR-{index + 1}.{idx + 1}
                                                </Badge>
                                                <span className="text-sm text-foreground/90">{renderMarkdown(cleanReq)}</span>
                                            </div>
                                        )
                                    })
                                ) : (
                                    <span className="text-sm text-muted-foreground italic">No specific requirements listed.</span>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
