"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { fetchProjects, createProject } from "@/lib/projects-api";
import { Project } from "@/types/project";

import Link from "next/link";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, Folder, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ProjectsPage() {
    const { token, isLoading: isAuthLoading } = useAuth();
    const router = useRouter();
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newProjectName, setNewProjectName] = useState("");

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
                <Button
                    onClick={() => setIsCreating(true)}
                    className="bg-foreground hover:bg-foreground/90 text-background rounded-full gap-2"
                >
                    <Plus className="h-4 w-4" /> New project
                </Button>
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
                            <div className="border border-foreground/10 p-6 hover:border-foreground/30 hover:bg-foreground/[0.02] transition-all duration-300 h-full">
                                <div className="flex items-start justify-between mb-4">
                                    <Folder className="h-5 w-5 text-muted-foreground" />
                                    <span className="text-xs font-mono text-muted-foreground border border-foreground/10 px-2 py-1">
                                        {project._count?.analyses || 0} analyses
                                    </span>
                                </div>
                                <h3 className="font-display text-xl mb-2">{project.name}</h3>
                                <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
                                    {project.description || "No description"}
                                </p>
                                <div className="mt-4 pt-4 border-t border-foreground/10 text-xs text-muted-foreground">
                                    Updated {format(new Date(project.updatedAt), 'MMM d, yyyy')}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
