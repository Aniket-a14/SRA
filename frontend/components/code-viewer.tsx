"use client"

import { useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { File, Code2, Copy, Check, Download, Database, Server, AppWindow, TestTube } from "lucide-react"
import { downloadCodebase } from "@/lib/export-utils"

interface FileNode {
    path: string
    type: "file" | "directory"
    children?: FileNode[]
    code?: string
}

interface CodeViewerProps {
    fileStructure: FileNode[]
    schema: string
    backendRoutes: { path: string, code: string }[]
    frontendComponents: { path: string, code: string }[]
    testCases: { path: string, code: string }[]
    backendReadme?: string
    frontendReadme?: string
    explanation: string
}

export function CodeViewer({ fileStructure, schema, backendRoutes, frontendComponents, testCases, backendReadme, frontendReadme, explanation }: CodeViewerProps) {
    const [selectedFile, setSelectedFile] = useState<{ path: string, code: string } | null>(null)
    const [copied, setCopied] = useState(false)

    // Helper to find code for a selected path from the various arrays
    const findCode = (path: string) => {
        if (path === "schema.prisma") return schema;
        if (path === "backend/README.md") return backendReadme || "";
        if (path === "frontend/README.md") return frontendReadme || "";
        const route = backendRoutes.find(r => r.path === path);
        if (route) return route.code;
        const component = frontendComponents.find(c => c.path === path);
        if (component) return component.code;
        const test = testCases.find(t => t.path === path);
        if (test) return test.code;
        return null;
    }



    const copyToClipboard = () => {
        if (selectedFile?.code) {
            navigator.clipboard.writeText(selectedFile.code)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }



    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-[600px] md:h-[calc(100vh-300px)] min-h-[500px] max-h-[800px]">
            {/* Sidebar: File List */}
            <Card className="md:col-span-1 bg-card border-border h-full flex flex-col min-w-0 overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-muted/40">
                    <h3 className="font-semibold text-sm">Generated Assets</h3>
                    <Button size="icon" variant="ghost" title="Download Codebase" onClick={() => downloadCodebase({ fileStructure, schema, backendRoutes, frontendComponents, testCases, backendReadme, frontendReadme }, "Generated_Project")}>
                        <Download className="h-4 w-4" />
                    </Button>
                </div>
                <ScrollArea className="flex-1 min-h-0">
                    <div className="p-2 space-y-4">
                        {/* Documentation Section */}
                        <div className="space-y-1">
                            <div className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                                <File className="h-3 w-3" /> Documentation
                            </div>
                            {backendReadme && (
                                <div className={`flex items-center gap-2 py-1.5 px-2 hover:bg-muted/50 rounded-md cursor-pointer text-sm transition-colors ${selectedFile?.path === "backend/README.md" ? "bg-primary/10 text-primary font-medium" : "text-foreground/80"}`}
                                    onClick={() => setSelectedFile({ path: "backend/README.md", code: backendReadme })}
                                >
                                    <File className="h-4 w-4 text-purple-500 shrink-0" />
                                    <span className="truncate">backend/README.md</span>
                                </div>
                            )}
                            {frontendReadme && (
                                <div className={`flex items-center gap-2 py-1.5 px-2 hover:bg-muted/50 rounded-md cursor-pointer text-sm transition-colors ${selectedFile?.path === "frontend/README.md" ? "bg-primary/10 text-primary font-medium" : "text-foreground/80"}`}
                                    onClick={() => setSelectedFile({ path: "frontend/README.md", code: frontendReadme })}
                                >
                                    <File className="h-4 w-4 text-blue-500 shrink-0" />
                                    <span className="truncate">frontend/README.md</span>
                                </div>
                            )}
                        </div>

                        {/* Schema Section */}
                        <div className="space-y-1">
                            <div className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                                <Database className="h-3 w-3" /> Database
                            </div>
                            <div className={`flex items-center gap-2 py-1.5 px-2 hover:bg-muted/50 rounded-md cursor-pointer text-sm transition-colors ${selectedFile?.path === "schema.prisma" ? "bg-primary/10 text-primary font-medium" : "text-foreground/80"}`}
                                onClick={() => setSelectedFile({ path: "schema.prisma", code: schema })}
                            >
                                <File className="h-4 w-4 text-emerald-500 shrink-0" />
                                <span className="truncate">schema.prisma</span>
                            </div>
                        </div>

                        {/* Backend Section */}
                        {backendRoutes.length > 0 && (
                            <div className="space-y-1">
                                <div className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <Server className="h-3 w-3" /> Backend
                                </div>
                                {backendRoutes.map((f, i) => (
                                    <div key={i} className={`flex items-center gap-2 py-1.5 px-2 hover:bg-muted/50 rounded-md cursor-pointer text-sm transition-colors ${selectedFile?.path === f.path ? "bg-primary/10 text-primary font-medium" : "text-foreground/80"}`}
                                        onClick={() => setSelectedFile(f)}
                                    >
                                        <File className="h-4 w-4 text-amber-500 shrink-0" />
                                        <span className="truncate">{f.path.split('/').pop()}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Frontend Section */}
                        {frontendComponents.length > 0 && (
                            <div className="space-y-1">
                                <div className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <AppWindow className="h-3 w-3" /> Frontend
                                </div>
                                {frontendComponents.map((f, i) => (
                                    <div key={i} className={`flex items-center gap-2 py-1.5 px-2 hover:bg-muted/50 rounded-md cursor-pointer text-sm transition-colors ${selectedFile?.path === f.path ? "bg-primary/10 text-primary font-medium" : "text-foreground/80"}`}
                                        onClick={() => setSelectedFile(f)}
                                    >
                                        <File className="h-4 w-4 text-cyan-500 shrink-0" />
                                        <span className="truncate">{f.path.split('/').pop()}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Tests Section */}
                        {testCases.length > 0 && (
                            <div className="space-y-1">
                                <div className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <TestTube className="h-3 w-3" /> Tests
                                </div>
                                {testCases.map((f, i) => (
                                    <div key={i} className={`flex items-center gap-2 py-1.5 px-2 hover:bg-muted/50 rounded-md cursor-pointer text-sm transition-colors ${selectedFile?.path === f.path ? "bg-primary/10 text-primary font-medium" : "text-foreground/80"}`}
                                        onClick={() => setSelectedFile(f)}
                                    >
                                        <File className="h-4 w-4 text-rose-500 shrink-0" />
                                        <span className="truncate">{f.path.split('/').pop()}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </ScrollArea>
                <div className="p-3 border-t bg-muted/20">
                    <div className="p-3 border-t bg-muted/20">
                        <Button className="w-full" variant="secondary" onClick={() => downloadCodebase({ fileStructure, schema, backendRoutes, frontendComponents, testCases, backendReadme, frontendReadme }, "Generated_Project")}>
                            <Download className="mr-2 h-4 w-4" />
                            Download Full Code
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Main: Code Editor/Viewer */}
            <Card className="md:col-span-3 bg-card border-border h-full flex flex-col overflow-hidden min-w-0">
                {selectedFile ? (
                    <>
                        <div className="flex items-center justify-between p-3 border-b bg-muted/40">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Code2 className="h-4 w-4 text-primary" />
                                {selectedFile.path}
                            </div>
                            <Button variant="ghost" size="sm" onClick={copyToClipboard}>
                                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                <span className="sr-only">Copy</span>
                            </Button>
                        </div>
                        <ScrollArea className="flex-1 min-h-0 bg-stone-950 text-stone-50 p-4 font-mono text-sm leading-relaxed">
                            <pre className="whitespace-pre-wrap">{selectedFile.code}</pre>
                        </ScrollArea>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center bg-muted/10">
                        <Code2 className="h-12 w-12 mb-4 opacity-50" />
                        <h3 className="text-lg font-medium">Select a file to view code</h3>
                        <p className="max-w-md mt-2 text-sm">{explanation}</p>
                    </div>
                )}
            </Card>
        </div>
    )
}
