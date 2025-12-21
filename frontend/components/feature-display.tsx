import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { SystemFeature } from "@/types/analysis"
import { getAcronym } from "@/lib/utils"
import { renderMarkdown } from "@/lib/render-markdown"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Plus, Trash2 } from "lucide-react"
import { EditableSection } from "@/components/editable-section"

interface FeatureDisplayProps {
    features: SystemFeature[]
    projectTitle?: string
    isEditing?: boolean
    onUpdate?: (features: SystemFeature[]) => void
}

export function FeatureDisplay({ features, projectTitle = "SRA", isEditing, onUpdate }: FeatureDisplayProps) {
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

    const updateFeature = (index: number, updates: Partial<SystemFeature>) => {
        if (!onUpdate) return;
        const newFeatures = [...features];
        newFeatures[index] = { ...newFeatures[index], ...updates };
        onUpdate(newFeatures);
    };

    const addFeature = () => {
        if (!onUpdate) return;
        onUpdate([
            ...features,
            {
                name: "New Feature",
                description: "Description of the new feature.",
                stimulusResponseSequences: [],
                functionalRequirements: []
            }
        ]);
    };

    const removeFeature = (index: number) => {
        if (!onUpdate) return;
        const newFeatures = features.filter((_, i) => i !== index);
        onUpdate(newFeatures);
    };

    return (
        <div className="space-y-6">
            {features.map((feature, index) => (
                <Card key={index} className="bg-card border-border transition-all duration-300 hover:border-primary/30">
                    <CardHeader className="pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            {isEditing ? (
                                <div className="flex-1 flex gap-2">
                                    <Input
                                        value={feature.name}
                                        onChange={(e) => updateFeature(index, { name: e.target.value })}
                                        className="font-semibold text-lg"
                                        placeholder="Feature Name"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:bg-destructive/10"
                                        onClick={() => removeFeature(index)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <CardTitle className="text-lg font-semibold text-primary">
                                    {feature.name}
                                </CardTitle>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h4 className="text-sm font-medium mb-2 text-foreground/80">Description</h4>
                            {isEditing ? (
                                <Textarea
                                    value={feature.description}
                                    onChange={(e) => updateFeature(index, { description: e.target.value })}
                                    className="min-h-[80px]"
                                />
                            ) : (
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {renderDescription(feature.name, feature.description)}
                                </p>
                            )}
                        </div>

                        {(isEditing || (feature.stimulusResponseSequences && feature.stimulusResponseSequences.length > 0)) && (
                            <div>
                                <h4 className="text-sm font-medium mb-2 text-foreground/80">Stimulus/Response Sequences</h4>
                                {isEditing ? (
                                    <EditableSection
                                        items={feature.stimulusResponseSequences || []}
                                        isEditing={true}
                                        onUpdate={(items) => updateFeature(index, { stimulusResponseSequences: items })}
                                        prefix="SEQ"
                                    />
                                ) : (
                                    <ul className="list-disc list-inside space-y-1">
                                        {feature.stimulusResponseSequences.map((seq, idx) => {
                                            const match = seq.match(/Stimulus:(.*?)Response:(.*)/i);
                                            if (match) {
                                                const stimulus = match[1].trim();
                                                const response = match[2].trim();
                                                return (
                                                    <li key={idx} className="text-sm text-foreground/90 pl-2 mb-2">
                                                        <div className="flex flex-col gap-1">
                                                            <div>
                                                                <span className="font-bold">Stimulus: </span>
                                                                {renderMarkdown(stimulus)}
                                                            </div>
                                                            <div className="pl-4">
                                                                <span className="font-bold">Response: </span>
                                                                {renderMarkdown(response)}
                                                            </div>
                                                        </div>
                                                    </li>
                                                );
                                            }
                                            return (
                                                <li key={idx} className="text-sm text-muted-foreground pl-2">
                                                    <span className="-ml-2">{renderMarkdown(seq)}</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        )}

                        <Separator className="bg-border/50" />

                        <div>
                            <h4 className="text-sm font-medium mb-3 text-foreground/80">Functional Requirements</h4>
                            {isEditing ? (
                                <EditableSection
                                    items={feature.functionalRequirements || []}
                                    isEditing={true}
                                    onUpdate={(items) => updateFeature(index, { functionalRequirements: items })}
                                    prefix={`${acronym}-FR-${index + 1}`}
                                />
                            ) : (
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
                            )}
                        </div>
                    </CardContent>
                </Card>
            ))}
            {isEditing && (
                <Button variant="outline" className="w-full border-dashed py-8" onClick={addFeature}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add System Feature
                </Button>
            )}
        </div>
    )
}
