"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { fetchProjects, createProject } from "@/lib/projects-api";
import { Project } from "@/types/project";
import useSWR from "swr";
import { fetcher, swrOptions } from "@/lib/swr-utils";

import Link from "next/link";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { Plus, Folder, Loader2, MessageSquare, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AnalysisHistoryItem {
    id: string
    createdAt: string
    inputPreview: string
    title?: string
}

export default function ProjectsPage() {
    const { token, isLoading: isAuthLoading } = useAuth();
    const router = useRouter();
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newProjectName, setNewProjectName] = useState("");

    const recentSwrKey = useMemo(() => {
        if (!token) return null;
        return [`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze`, token] as const;
    }, [token]);
    const { data: recentData } = useSWR<AnalysisHistoryItem[]>(recentSwrKey, fetcher, swrOptions);
    const recent = (Array.isArray(recentData) ? recentData : []).slice(0, 4);

    useEffect(() => {
        if (isAuthLoading) return;

        const loadProjects = async () => {
            try {
                const data = await fetchProjects(token!);
                setProjects(data);
            } catch {
                toast.error("Failed to load projects");
            } finally {
                Promise.resolve().then(() => setIsLoading(false));
            }
        };

        if (token) {
            loadProjects();
        } else {
            Promise.resolve().then(() => setIsLoading(false));
            router.push("/");
        }
    }, [token, isAuthLoading, router]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const project = await createProject(token!, { name: newProjectName });
            setProjects([project, ...projects]);
            setNewProjectName("");
            setIsCreating(false);
            toast.success("Project created");
        } catch {
            toast.error("Failed to create project");
        }
    };

    return (
        <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-12">
            <div className="flex justify-between items-center mb-10">
                <h1 className="text-3xl lg:text-4xl font-display tracking-tight">Projects</h1>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        className="rounded-full gap-2"
                        onClick={() => router.push("/analysis/new")}
                    >
                        <MessageSquare className="h-4 w-4" /> New analysis
                    </Button>
                    <Button
                        onClick={() => setIsCreating(true)}
                        className="bg-foreground hover:bg-foreground/90 text-background rounded-full gap-2"
                    >
                        <Plus className="h-4 w-4" /> New project
                    </Button>
                </div>
            </div>

            {isCreating && (
                <form onSubmit={handleCreate} className="mb-10 p-4 border border-foreground/10 flex gap-4">
                    <Input
                        type="text"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        placeholder="Project name"
                        className="flex-1"
                        required
                        autoFocus
                    />
                    <Button type="submit" className="bg-foreground hover:bg-foreground/90 text-background rounded-full">
                        Create
                    </Button>
                    <Button type="button" variant="outline" className="rounded-full" onClick={() => setIsCreating(false)}>
                        Cancel
                    </Button>
                </form>
            )}

            {/* Recent activity — a quick-access row of your latest analyses across all
                projects, ChatGPT/Gemini-style, ahead of the project folders themselves. */}
            {recent.length > 0 && (
                <div className="mb-12">
                    <h2 className="text-xs font-mono uppercase tracking-wide text-muted-foreground mb-3">
                        Jump back in
                    </h2>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {recent.map((item) => (
                            <Link key={item.id} href={`/analysis/${item.id}`}>
                                <div className="border border-foreground/10 p-4 hover:border-foreground/30 hover:bg-foreground/[0.02] transition-all h-full flex flex-col justify-between">
                                    <p className="text-sm font-medium line-clamp-2 mb-3">
                                        {item.title || item.inputPreview || "Untitled analysis"}
                                    </p>
                                    <p className="text-xs text-muted-foreground font-mono">
                                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            <h2 className="text-xs font-mono uppercase tracking-wide text-muted-foreground mb-3">
                All projects
            </h2>

            {isLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground py-20 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading projects…
                </div>
            ) : projects.length === 0 ? (
                <div className="text-center py-24 border border-dashed border-foreground/10">
                    <Folder className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-display mb-2">No projects yet</h3>
                    <p className="text-muted-foreground">Create your first project to get started</p>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map(project => (
                        <Link key={project.id} href={`/projects/${project.id}`}>
                            <div className="group border border-foreground/10 p-6 hover:border-foreground/30 hover:bg-foreground/[0.02] transition-all duration-300 h-full flex flex-col">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="h-9 w-9 rounded-full bg-foreground/5 flex items-center justify-center">
                                        <Folder className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <span className="text-xs font-mono text-muted-foreground border border-foreground/10 px-2 py-1">
                                        {project._count?.analyses || 0} analyses
                                    </span>
                                </div>
                                <h3 className="font-display text-xl mb-2">{project.name}</h3>
                                <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px] flex-1">
                                    {project.description || "No description"}
                                </p>
                                <div className="mt-4 pt-4 border-t border-foreground/10 flex items-center justify-between text-xs text-muted-foreground">
                                    <span>Updated {format(new Date(project.updatedAt), 'MMM d, yyyy')}</span>
                                    <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
