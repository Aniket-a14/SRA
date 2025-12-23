"use client"



import { cleanInputText } from "@/lib/utils"

interface DiffChange<T> {
    old: T
    new: T
}

interface AnalysisDiff {
    inputText?: DiffChange<string>
    functionalRequirements?: DiffChange<string[]>
    nonFunctionalRequirements?: DiffChange<string[]>
    userStories?: DiffChange<Record<string, unknown>[]> // UserStory[]
}

interface VersionDiffViewerProps {
    diff: AnalysisDiff
}

export function VersionDiffViewer({ diff }: VersionDiffViewerProps) {
    if (Object.keys(diff).length === 0) {
        return <div className="p-8 text-center text-muted-foreground">No changes detected in the scoped fields (Input, FRs, NFRs, Stories).</div>
    }

    return (
        <div className="space-y-8">
            {diff.inputText && (
                <DiffSection title="Input / Refinement Context">
                    <DiffText
                        oldText={cleanInputText(diff.inputText.old)}
                        newText={cleanInputText(diff.inputText.new)}
                    />
                </DiffSection>
            )}

            {diff.functionalRequirements && (
                <DiffSection title="Functional Requirements">
                    <DiffList oldList={diff.functionalRequirements.old} newList={diff.functionalRequirements.new} />
                </DiffSection>
            )}

            {diff.nonFunctionalRequirements && (
                <DiffSection title="Non-Functional Requirements">
                    <DiffList oldList={diff.nonFunctionalRequirements.old} newList={diff.nonFunctionalRequirements.new} />
                </DiffSection>
            )}

            {diff.userStories && (
                <DiffSection title="User Stories">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="border rounded-md p-4 bg-muted/20">
                            <h5 className="font-semibold mb-2 text-red-500">Version 1</h5>
                            <ul className="space-y-3">
                                {Array.isArray(diff.userStories.old) && diff.userStories.old.map((story: any, i: number) => (
                                    <li key={i} className="text-sm border p-2 rounded bg-background/50">
                                        <div className="font-medium mb-1">{story.userStory || story.description || JSON.stringify(story)}</div>
                                        {story.acceptanceCriteria && (
                                            <ul className="list-disc pl-4 text-xs text-muted-foreground">
                                                {Array.isArray(story.acceptanceCriteria) ? story.acceptanceCriteria.map((ac: string, j: number) => (
                                                    <li key={j}>{ac}</li>
                                                )) : <li>{story.acceptanceCriteria}</li>}
                                            </ul>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="border rounded-md p-4 bg-muted/20">
                            <h5 className="font-semibold mb-2 text-green-500">Version 2</h5>
                            <ul className="space-y-3">
                                {Array.isArray(diff.userStories.new) && diff.userStories.new.map((story: any, i: number) => (
                                    <li key={i} className="text-sm border p-2 rounded bg-background/50">
                                        <div className="font-medium mb-1">{story.userStory || story.description || JSON.stringify(story)}</div>
                                        {story.acceptanceCriteria && (
                                            <ul className="list-disc pl-4 text-xs text-muted-foreground">
                                                {Array.isArray(story.acceptanceCriteria) ? story.acceptanceCriteria.map((ac: string, j: number) => (
                                                    <li key={j}>{ac}</li>
                                                )) : <li>{story.acceptanceCriteria}</li>}
                                            </ul>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </DiffSection>
            )}
        </div>
    )
}

function DiffSection({ title, children }: { title: string, children: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <h3 className="text-lg font-bold">{title}</h3>
            {children}
        </div>
    )
}

function DiffText({ oldText, newText }: { oldText: string, newText: string }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-md border bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
                <div className="text-xs font-mono text-muted-foreground mb-1">Original</div>
                <div className="text-sm whitespace-pre-wrap break-words">{oldText}</div>
            </div>
            <div className="p-4 rounded-md border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
                <div className="text-xs font-mono text-muted-foreground mb-1">New</div>
                <div className="text-sm whitespace-pre-wrap break-words">{newText}</div>
            </div>
        </div>
    )
}


function DiffList({ oldList, newList }: { oldList: string[], newList: string[] }) {
    // Simple side-by-side list for now. Smart diff would highlight insertions/deletions.
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-md border">
                <h4 className="text-sm font-semibold mb-2 text-red-500">Old Version</h4>
                <ul className="list-disc pl-4 space-y-1">
                    {oldList?.map((item, i) => (
                        <li key={i} className="text-sm text-muted-foreground">{item}</li>
                    ))}
                </ul>
            </div>
            <div className="p-4 rounded-md border">
                <h4 className="text-sm font-semibold mb-2 text-green-500">New Version</h4>
                <ul className="list-disc pl-4 space-y-1">
                    {newList?.map((item, i) => (
                        <li key={i} className="text-sm">{item}</li>
                    ))}
                </ul>
            </div>
        </div>
    )
}

