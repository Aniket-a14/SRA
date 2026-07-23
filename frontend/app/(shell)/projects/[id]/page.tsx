"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { fetchProject, updateProject, deleteProject } from "@/lib/projects-api";
import { Project } from "@/types/project";
import { cleanInputText } from "@/lib/utils";

import Link from "next/link";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowLeft, Edit2, Trash2, FileText, Calendar, Plus, Loader2 } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export default function ProjectDetailPage() {
    const { token } = useAuth();
    const params = useParams();
    const router = useRouter();
    const [project, setProject] = useState<Project | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState("");
    const [editDesc, setEditDesc] = useState("");

    useEffect(() => {
        const loadProject = async (id: string) => {
            try {
                const data = await fetchProject(token!, id);
                setProject(data);
                setEditName(data.name);
                setEditDesc(data.description || "");
            } catch {
                toast.error("Failed to load project");
                router.push("/projects");
            } finally {
                setIsLoading(false);
            }
        };

        if (token && params.id) {
            loadProject(params.id as string);
        }
    }, [token, params.id, router]);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const updated = await updateProject(token!, project!.id, {
                name: editName,
                description: editDesc
            });
            setProject(updated);
            setIsEditing(false);
            toast.success("Project updated");
        } catch {
            toast.error("Failed to update project");
        }
    };

    const handleDelete = async () => {
        try {
            await deleteProject(token!, project!.id);
            toast.success("Project deleted");
            router.push("/projects");
        } catch {
            toast.error("Failed to delete project");
        }
    };

    if (isLoading) return (
        <div className="h-full flex items-center justify-center p-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
        </div>
    );
    if (!project) return null;

    return (
        <div className="max-w-[1000px] mx-auto px-6 lg:px-12 py-12">
            <Link href="/projects" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
                <ArrowLeft size={14} className="mr-2" /> Back to projects
            </Link>

            {isEditing ? (
                <form onSubmit={handleUpdate} className="border border-foreground/10 p-6 mb-10 space-y-4">
                    <div>
                        <label className="block text-xs font-mono uppercase tracking-wide text-muted-foreground mb-2">Project name</label>
                        <Input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-mono uppercase tracking-wide text-muted-foreground mb-2">Description</label>
                        <Textarea
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            rows={3}
                        />
                    </div>
                    <div className="flex gap-3">
                        <Button type="submit" className="bg-foreground hover:bg-foreground/90 text-background rounded-full">
                            Save changes
                        </Button>
                        <Button type="button" variant="outline" className="rounded-full" onClick={() => setIsEditing(false)}>
                            Cancel
                        </Button>
                    </div>
                </form>
            ) : (
                <div className="flex justify-between items-start mb-10 border-b border-foreground/10 pb-6">
                    <div>
                        <h1 className="text-3xl lg:text-4xl font-display tracking-tight mb-2">{project?.name}</h1>
                        <p className="text-muted-foreground">{project?.description}</p>
                        <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1 font-mono text-xs">
                                <Calendar size={13} /> Created {format(new Date(project!.createdAt), 'PPP')}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} aria-label="Edit project">
                            <Edit2 size={16} />
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" aria-label="Delete project">
                                    <Trash2 size={16} />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete your project and remove all associated analyses.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
            )}

            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-display flex items-center gap-2">
                        <FileText size={20} /> Recent analyses
                    </h2>
                    <Button
                        asChild
                        className="bg-foreground hover:bg-foreground/90 text-background rounded-full gap-2"
                    >
                        <Link href={`/analysis/new?projectId=${project?.id}`}>
                            <Plus size={16} /> New analysis
                        </Link>
                    </Button>
                </div>

                {project?.analyses && project.analyses.length > 0 ? (
                    <div className="grid gap-3">
                        {project.analyses.map(analysis => (
                            <Link key={analysis.id} href={`/analysis/${analysis.id}`}>
                                <div className="p-4 border border-foreground/10 hover:border-foreground/30 hover:bg-foreground/[0.02] transition-all duration-300">
                                    <div className="flex justify-between items-center mb-1">
                                        <h3 className="font-medium">{analysis.title || `Analysis ${analysis.version}`}</h3>
                                        <span className="text-xs font-mono text-muted-foreground">v{analysis.version}</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground line-clamp-1">
                                        {cleanInputText(analysis.inputText || "")}
                                    </p>
                                    <div className="flex justify-between mt-2 text-xs text-muted-foreground font-mono">
                                        <span>{format(new Date(analysis.createdAt), 'MMM d, h:mm a')}</span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <p className="text-muted-foreground italic text-sm">No analyses in this project yet.</p>
                )}
            </div>
        </div>
    );
}
