"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { fetchProjects, createProject } from "@/lib/projects-api";
import { Project } from "@/types/project";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import Link from "next/link";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, Folder } from "lucide-react";

export default function ProjectsPage() {
    const { token, user } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newProjectName, setNewProjectName] = useState("");

    useEffect(() => {
        const loadProjects = async () => {
            try {
                const data = await fetchProjects(token!);
                setProjects(data);
            } catch {
                toast.error("Failed to load projects");
            } finally {
                setIsLoading(false);
            }
        };

        if (token) {
            loadProjects();
        }
    }, [token]);

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

    if (!user) {
        return (
            <div className="min-h-screen flex flex-col">
                <Navbar />
                <div className="flex-1 flex items-center justify-center">
                    <p>Please log in to view projects</p>
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <Navbar />
            <main className="flex-1 container mx-auto px-4 py-8">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold">My Projects</h1>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="bg-primary text-primary-foreground px-4 py-2 rounded-md flex items-center gap-2 hover:bg-primary/90 transition"
                    >
                        <Plus size={16} /> New Project
                    </button>
                </div>

                {isCreating && (
                    <form onSubmit={handleCreate} className="mb-8 p-4 border rounded-md bg-secondary/20">
                        <div className="flex gap-4">
                            <input
                                type="text"
                                value={newProjectName}
                                onChange={(e) => setNewProjectName(e.target.value)}
                                placeholder="Project Name"
                                className="flex-1 px-4 py-2 rounded-md border"
                                required
                            />
                            <button type="submit" className="bg-primary text-primary-foreground px-6 py-2 rounded-md hover:bg-primary/90">
                                Create
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsCreating(false)}
                                className="px-6 py-2 rounded-md hover:bg-muted"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                )}

                {isLoading ? (
                    <p>Loading projects...</p>
                ) : projects.length === 0 ? (
                    <div className="text-center py-20 border rounded-md border-dashed">
                        <Folder className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-xl font-semibold mb-2">No projects yet</h3>
                        <p className="text-muted-foreground">Create your first project to get started</p>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.map(project => (
                            <Link key={project.id} href={`/projects/${project.id}`}>
                                <div className="border rounded-lg p-6 hover:shadow-lg transition bg-card">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="bg-primary/10 p-2 rounded">
                                            <Folder className="h-6 w-6 text-primary" />
                                        </div>
                                        <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                                            {project._count?.analyses || 0} analyses
                                        </span>
                                    </div>
                                    <h3 className="font-semibold text-xl mb-2">{project.name}</h3>
                                    <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
                                        {project.description || "No description"}
                                    </p>
                                    <div className="mt-4 pt-4 border-t flex justify-between text-xs text-muted-foreground">
                                        <span>Updated {format(new Date(project.updatedAt), 'MMM d, yyyy')}</span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </main>
            <Footer />
        </div>
    );
}
