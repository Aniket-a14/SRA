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
import { formatDistanceToNow } from "date-fns";
import { Plus, Folder, MessageSquare, Search, Clock, ArrowUpRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

interface AnalysisHistoryItem {
    id: string
    createdAt: string
    inputPreview: string
    title?: string
}

/** Deterministic soft gradient per project so the grid reads as distinct tiles at a glance. */
const GRADIENTS = [
    "from-violet-500/20 to-indigo-500/10",
    "from-emerald-500/20 to-teal-500/10",
    "from-amber-500/20 to-orange-500/10",
    "from-sky-500/20 to-blue-500/10",
    "from-rose-500/20 to-pink-500/10",
    "from-fuchsia-500/20 to-purple-500/10",
];
function gradientFor(seed: string) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return GRADIENTS[h % GRADIENTS.length];
}
function initials(name: string) {
    return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("") || "P";
}

export default function ProjectsPage() {
    const { token, isLoading: isAuthLoading } = useAuth();
    const router = useRouter();
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newProjectName, setNewProjectName] = useState("");
    const [query, setQuery] = useState("");

    const recentSwrKey = useMemo(() => {
        if (!token) return null;
        return [`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze`, token] as const;
    }, [token]);
    const { data: recentData } = useSWR<AnalysisHistoryItem[]>(recentSwrKey, fetcher, swrOptions);
    const recent = (Array.isArray(recentData) ? recentData : []).slice(0, 6);

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

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return projects;
        return projects.filter(p =>
            p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q)
        );
    }, [projects, query]);

    return (
        <div className="min-h-screen">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
                {/* Header */}
                <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Projects</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Workspaces for the systems you&apos;re specifying.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            className="gap-2 rounded-lg"
                            onClick={() => router.push("/analysis/new")}
                        >
                            <MessageSquare className="h-4 w-4" /> New analysis
                        </Button>
                        <Button
                            onClick={() => setIsCreating(true)}
                            className="gap-2 rounded-lg bg-foreground text-background hover:bg-foreground/90"
                        >
                            <Plus className="h-4 w-4" /> New project
                        </Button>
                    </div>
                </div>

                {/* Search */}
                <div className="relative mt-6">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search projects…"
                        className="h-11 rounded-xl pl-9"
                    />
                </div>

                {/* Inline create */}
                {isCreating && (
                    <form onSubmit={handleCreate} className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-card/50 p-2 pl-4">
                        <Input
                            type="text"
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            placeholder="Name your project…"
                            className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
                            required
                            autoFocus
                        />
                        <Button type="submit" size="sm" className="rounded-lg bg-foreground text-background hover:bg-foreground/90">Create</Button>
                        <Button type="button" size="icon" variant="ghost" className="rounded-lg" onClick={() => setIsCreating(false)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </form>
                )}

                {/* Recent activity */}
                {recent.length > 0 && (
                    <section className="mt-9">
                        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <Clock className="h-4 w-4" /> Jump back in
                        </div>
                        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
                            {recent.map((item) => (
                                <Link
                                    key={item.id}
                                    href={`/analysis/${item.id}`}
                                    className="group min-w-[210px] max-w-[210px] shrink-0 rounded-xl border border-border bg-card/50 p-4 transition-colors hover:border-foreground/25 hover:bg-card"
                                >
                                    <div className="mb-6 flex items-center justify-between">
                                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                        <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                                    </div>
                                    <p className="line-clamp-2 text-sm font-medium leading-snug">
                                        {item.title || item.inputPreview || "Untitled analysis"}
                                    </p>
                                    <p className="mt-1.5 text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                                    </p>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* Projects */}
                <section className="mt-9">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-sm font-medium text-muted-foreground">All projects</h2>
                        {!isLoading && projects.length > 0 && (
                            <span className="text-xs text-muted-foreground">{filtered.length} of {projects.length}</span>
                        )}
                    </div>

                    {isLoading ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="rounded-2xl border border-border p-5">
                                    <Skeleton className="h-11 w-11 rounded-xl" />
                                    <Skeleton className="mt-4 h-5 w-2/3" />
                                    <Skeleton className="mt-2 h-4 w-full" />
                                    <Skeleton className="mt-1.5 h-4 w-4/5" />
                                    <Skeleton className="mt-6 h-3 w-1/2" />
                                </div>
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border py-16 text-center">
                            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                                <Folder className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-medium">
                                {query ? "No matches" : "No projects yet"}
                            </h3>
                            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                                {query
                                    ? "Try a different search term."
                                    : "Create your first project to start turning stakeholder text into verifiable specs."}
                            </p>
                            {!query && (
                                <Button onClick={() => setIsCreating(true)} className="mt-5 gap-2 rounded-lg bg-foreground text-background hover:bg-foreground/90">
                                    <Plus className="h-4 w-4" /> New project
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {filtered.map((project) => (
                                <Link key={project.id} href={`/projects/${project.id}`} className="group">
                                    <div className="flex h-full flex-col rounded-2xl border border-border bg-card/40 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-card hover:shadow-sm">
                                        <div className="flex items-start justify-between">
                                            <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradientFor(project.id)} text-sm font-semibold`}>
                                                {initials(project.name)}
                                            </div>
                                            <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                                                {project._count?.analyses || 0} analyses
                                            </span>
                                        </div>
                                        <h3 className="mt-4 line-clamp-1 text-lg font-semibold group-hover:text-foreground">
                                            {project.name}
                                        </h3>
                                        <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">
                                            {project.description || "No description yet."}
                                        </p>
                                        <div className="mt-5 flex items-center justify-between border-t border-border/70 pt-3 text-xs text-muted-foreground">
                                            <span>Updated {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}</span>
                                            <ArrowUpRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
