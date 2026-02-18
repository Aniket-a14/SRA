"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Zap, CheckCircle2, Database } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

interface RequirementContent {
    description?: string;
    story?: string;
    [key: string]: unknown;
}

interface RecyclingCandidate {
    id: string;
    type: string;
    content: RequirementContent | string;
    tags: string[];
    qualityScore: number;
}

interface RecyclingPanelProps {
    onApply: (content: Record<string, unknown> | string) => void;
}

export function RecyclingPanel({ onApply }: RecyclingPanelProps) {
    const { token } = useAuth();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<RecyclingCandidate[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!query.trim()) return;

        setIsSearching(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/reuse/suggest`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ query })
            });

            if (!res.ok) throw new Error("Search failed");
            const data = await res.json();
            setResults(data.data.suggestions || []);
        } catch {
            toast.error("Failed to find recycling candidates");
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="flex flex-col h-full gap-4">
            <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Requirement Recycling
                </h3>
                <p className="text-xs text-muted-foreground">
                    Search for &quot;Gold Standard&quot; fragments from your past projects.
                </p>
                <form onSubmit={handleSearch} className="flex gap-2">
                    <Input
                        placeholder="Search fragments (e.g. auth, billing)"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="h-8 text-xs"
                    />
                    <Button size="sm" variant="secondary" className="h-8 px-2" disabled={isSearching}>
                        {isSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                    </Button>
                </form>
            </div>

            <div className="flex-1 overflow-auto space-y-3 pr-2">
                {results.length === 0 && !isSearching && (
                    <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/5">
                        <Database className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">No matches found</p>
                    </div>
                )}

                {results.map((item) => (
                    <Card key={item.id} className="group relative overflow-hidden border-primary/10 hover:border-primary/30 transition-all shadow-sm">
                        <CardHeader className="p-3 pb-0">
                            <div className="flex items-center justify-between">
                                <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary/70">
                                    {item.type}
                                </Badge>
                                {item.qualityScore >= 0.85 && (
                                    <Badge className="bg-green-500/10 text-green-600 text-[9px] border-green-200">
                                        GOLD STANDARD
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-3 pt-2 space-y-2">
                            <p className="text-xs line-clamp-3 text-muted-foreground italic">
                                &quot;{typeof item.content === 'object' ? (item.content as RequirementContent).description || (item.content as RequirementContent).story : item.content}&quot;
                            </p>

                            <div className="flex flex-wrap gap-1">
                                {item.tags.slice(0, 3).map(tag => (
                                    <span key={tag} className="text-[9px] bg-muted px-1 rounded text-muted-foreground">
                                        #{tag}
                                    </span>
                                ))}
                            </div>

                            <Button
                                size="sm"
                                variant="ghost"
                                className="w-full h-7 text-[10px] gap-1 hover:bg-primary/5 hover:text-primary border border-transparent hover:border-primary/20"
                                onClick={() => onApply(item.content)}
                            >
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                                Apply to Workspace
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
