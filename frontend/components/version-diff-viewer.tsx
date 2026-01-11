import { cleanInputText, cn } from "@/lib/utils"
import {
    Introduction,
    OverallDescription,
    ExternalInterfaceRequirements,
    SystemFeature,
    NonFunctionalRequirements,
    Appendices
} from "@/types/analysis"

interface DiffChange<T> {
    old: T
    new: T
}

interface AnalysisDiff {
    inputText?: DiffChange<string>
    introduction?: DiffChange<Introduction>
    overallDescription?: DiffChange<OverallDescription>
    externalInterfaceRequirements?: DiffChange<ExternalInterfaceRequirements>
    systemFeatures?: DiffChange<SystemFeature[]>
    nonFunctionalRequirements?: DiffChange<NonFunctionalRequirements>
    otherRequirements?: DiffChange<string[]>
    appendices?: DiffChange<Appendices>
}

interface VersionDiffViewerProps {
    diff: AnalysisDiff
}

export function VersionDiffViewer({ diff }: VersionDiffViewerProps) {
    if (Object.keys(diff).length === 0) {
        return <div className="p-8 text-center text-muted-foreground italic border rounded-lg bg-muted/5">No changes detected in this version.</div>
    }

    return (
        <div className="space-y-10">
            {diff.inputText && (
                <DiffSection title="Refinement Input" badge="Intent">
                    <DiffText
                        oldText={cleanInputText(diff.inputText.old)}
                        newText={cleanInputText(diff.inputText.new)}
                    />
                </DiffSection>
            )}

            {diff.introduction && (
                <DiffSection title="1. Introduction" badge="Context">
                    <DiffObject oldObj={diff.introduction.old} newObj={diff.introduction.new} />
                </DiffSection>
            )}

            {diff.overallDescription && (
                <DiffSection title="2. Overall Description" badge="Perspective">
                    <DiffObject oldObj={diff.overallDescription.old} newObj={diff.overallDescription.new} />
                </DiffSection>
            )}

            {diff.systemFeatures && (
                <DiffSection title="3. System Features" badge="Capabilities">
                    <DiffFeatures oldFeatures={diff.systemFeatures.old} newFeatures={diff.systemFeatures.new} />
                </DiffSection>
            )}

            {diff.nonFunctionalRequirements && (
                <DiffSection title="4. Non-Functional Requirements" badge="Quality">
                    <DiffObject oldObj={diff.nonFunctionalRequirements.old} newObj={diff.nonFunctionalRequirements.new} />
                </DiffSection>
            )}

            {diff.externalInterfaceRequirements && (
                <DiffSection title="5. External Interfaces" badge="Integration">
                    <DiffObject oldObj={diff.externalInterfaceRequirements.old} newObj={diff.externalInterfaceRequirements.new} />
                </DiffSection>
            )}

            {diff.otherRequirements && (
                <DiffSection title="6. Other Requirements" badge="Scope">
                    <DiffList oldList={diff.otherRequirements.old} newList={diff.otherRequirements.new} />
                </DiffSection>
            )}

            {diff.appendices && (
                <DiffSection title="7. Appendices" badge="Diagrams">
                    <DiffDiagrams oldApp={diff.appendices.old} newApp={diff.appendices.new} />
                </DiffSection>
            )}
        </div>
    )
}

function DiffSection({ title, badge, children }: { title: string, badge?: string, children: React.ReactNode }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 border-b pb-2">
                <h3 className="text-lg font-bold tracking-tight">{title}</h3>
                {badge && <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{badge}</span>}
            </div>
            {children}
        </div>
    )
}

function DiffText({ oldText, newText }: { oldText: string, newText: string }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 rounded-xl border bg-red-50/30 dark:bg-red-950/10 border-red-200/50 dark:border-red-900/30">
                <div className="text-[10px] uppercase font-bold text-red-600 mb-2 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-600" /> Previous
                </div>
                <div className="text-sm whitespace-pre-wrap break-words leading-relaxed opacity-70 italic">{oldText}</div>
            </div>
            <div className="p-4 rounded-xl border bg-green-50/30 dark:bg-green-950/10 border-green-200/50 dark:border-green-900/30 shadow-sm">
                <div className="text-[10px] uppercase font-bold text-green-600 mb-2 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-600 animate-pulse" /> Updated
                </div>
                <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">{newText}</div>
            </div>
        </div>
    )
}

function DiffObject<T extends object>({ oldObj, newObj }: { oldObj: T | undefined, newObj: T | undefined }) {
    const keys = Array.from(new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]));

    return (
        <div className="space-y-4">
            {keys.map(key => {
                const o = (oldObj as Record<string, unknown>)?.[key];
                const n = (newObj as Record<string, unknown>)?.[key];
                if (JSON.stringify(o) === JSON.stringify(n)) return null;

                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

                return (
                    <div key={key} className="space-y-1.5">
                        <label className="text-[11px] font-bold text-muted-foreground ml-1 uppercase tracking-wider">{label}</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-3 rounded-lg border bg-secondary/20 text-xs italic opacity-60">
                                {Array.isArray(o) ? o.join(", ") : String(o ?? "N/A")}
                            </div>
                            <div className="p-3 rounded-lg border bg-primary/5 text-xs font-medium border-primary/20">
                                {Array.isArray(n) ? n.join(", ") : String(n ?? "N/A")}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function DiffFeatures({ oldFeatures, newFeatures }: { oldFeatures: SystemFeature[], newFeatures: SystemFeature[] }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <h4 className="text-[10px] uppercase font-bold text-red-600 mb-2 flex items-center gap-2 px-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-600" /> V1 Features
                </h4>
                <div className="space-y-3 opacity-60 italic">
                    {oldFeatures.map((f, i) => (
                        <div key={i} className="p-3 rounded-xl border bg-muted/30 text-xs">
                            <div className="font-bold mb-1">{f.name}</div>
                            <div className="line-clamp-2 mb-2">{f.description}</div>
                            {f.functionalRequirements?.length > 0 && (
                                <div className="text-[10px] border-t pt-2 mt-2">
                                    <span className="font-bold uppercase tracking-tighter">Requirements:</span> {f.functionalRequirements.length} items
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            <div className="space-y-4">
                <h4 className="text-[10px] uppercase font-bold text-green-600 mb-2 flex items-center gap-2 px-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-600 animate-pulse" /> V2 Features
                </h4>
                <div className="space-y-3">
                    {newFeatures.map((f, i) => {
                        const isNew = !oldFeatures.find(of => of.name === f.name);
                        return (
                            <div key={i} className={cn(
                                "p-3 rounded-xl border text-xs shadow-sm",
                                isNew ? "bg-green-500/5 border-green-500/30" : "bg-card border-border"
                            )}>
                                <div className="flex items-center justify-between mb-1">
                                    <div className="font-bold text-primary">{f.name}</div>
                                    {isNew && <span className="text-[9px] bg-green-500/20 text-green-700 px-1.5 py-0.5 rounded font-bold">NEW</span>}
                                </div>
                                <div className="line-clamp-3 leading-relaxed mb-2">{f.description}</div>
                                {f.functionalRequirements?.length > 0 && (
                                    <div className="text-[10px] border-t pt-2 mt-2 font-medium text-muted-foreground">
                                        <span className="font-bold uppercase tracking-tighter">Requirements:</span> {f.functionalRequirements.join(" • ")}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function DiffDiagrams({ oldApp, newApp }: { oldApp: Appendices, newApp: Appendices }) {
    const oldModels = (oldApp.analysisModels || {}) as Record<string, unknown>;
    const newModels = (newApp.analysisModels || {}) as Record<string, unknown>;
    const keys = Array.from(new Set([...Object.keys(oldModels), ...Object.keys(newModels)]));

    return (
        <div className="space-y-4">
            {keys.map(key => {
                const o = oldModels[key];
                const n = newModels[key];

                const getCode = (val: unknown): string => {
                    if (typeof val === 'string') return val;
                    if (val && typeof val === 'object' && 'code' in val) {
                        return (val as { code: string }).code || "";
                    }
                    return "";
                };

                const oCode = getCode(o);
                const nCode = getCode(n);

                if (oCode === nCode) return null;

                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

                return (
                    <div key={key} className="space-y-1.5">
                        <label className="text-[11px] font-bold text-muted-foreground ml-1 uppercase tracking-wider">{label}</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-3 rounded-lg border bg-secondary/20 text-xs italic opacity-60 overflow-hidden text-ellipsis whitespace-nowrap">
                                {oCode ? "Diagram Modified" : "N/A"}
                            </div>
                            <div className="p-3 rounded-lg border bg-primary/5 text-xs font-medium border-primary/20">
                                {nCode ? (oCode ? "Updated Code" : "Initial Diagram") : "Removed"}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function DiffList({ oldList, newList }: { oldList: string[], newList: string[] }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border bg-muted/20 text-xs italic opacity-60">
                <ul className="list-disc pl-4 space-y-2">
                    {oldList?.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
            </div>
            <div className="p-4 rounded-xl border bg-primary/5 text-xs font-medium border-primary/20">
                <ul className="list-disc pl-4 space-y-2">
                    {newList?.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
            </div>
        </div>
    )
}

