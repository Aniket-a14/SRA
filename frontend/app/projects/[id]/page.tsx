"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { fetchProject, updateProject, deleteProject } from "@/lib/projects-api";
import { Project } from "@/types/project";
import { cleanInputText } from "@/lib/utils";

import Link from "next/link";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowLeft, Edit2, Trash2, FileText, Calendar, Plus } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
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
    const { token, csrfToken } = useAuth();
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
            }, csrfToken);
            setProject(updated);
            setIsEditing(false);
            toast.success("Project updated");
        } catch {
            toast.error("Failed to update project");
        }
    };

    const handleDelete = async () => {
        try {
            await deleteProject(token!, project!.id, csrfToken);
            toast.success("Project deleted");
            router.push("/projects");
        } catch {
            toast.error("Failed to delete project");
        }
    };

    if (isLoading) return <div className="h-full flex items-center justify-center p-8"><span className="loading loading-spinner loading-lg text-primary"></span></div>;
    if (!project) return null;

    return (
        <div className="container mx-auto px-4 py-8 h-full">
            <Link href="/projects" className="flex items-center text-muted-foreground hover:text-foreground mb-6 transition">
                <ArrowLeft size={16} className="mr-2" /> Back to Projects
            </Link>

            {isEditing ? (
                <form onSubmit={handleUpdate} className="bg-card p-6 rounded-lg border shadow-sm mb-8">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Project Name</label>
                            <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full px-4 py-2 rounded-md border"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Description</label>
                            <textarea
                                value={editDesc}
                                onChange={(e) => setEditDesc(e.target.value)}
                                className="w-full px-4 py-2 rounded-md border"
                                rows={3}
                            />
                        </div>
                        <div className="flex gap-4">
                            <button type="submit" className="bg-primary text-primary-foreground px-6 py-2 rounded-md hover:bg-primary/90">
                                Save Changes
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                className="px-6 py-2 rounded-md hover:bg-muted"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </form>
            ) : (
                <div className="flex justify-between items-start mb-8 border-b pb-6">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">{project?.name}</h1>
                        <p className="text-muted-foreground">{project?.description}</p>
                        <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1"><Calendar size={14} /> Created {format(new Date(project!.createdAt), 'PPP')}</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsEditing(true)}
                            className="p-2 hover:bg-muted rounded-full transition"
                            title="Edit Project"
                        >
                            <Edit2 size={20} />
                        </button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <button
                                    className="p-2 hover:bg-destructive/10 text-destructive rounded-full transition"
                                    title="Delete Project"
                                >
                                    <Trash2 size={20} />
                                </button>
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
                    <h2 className="text-2xl font-semibold flex items-center gap-2">
                        <FileText size={24} /> Recent Analyses
                    </h2>
                    <Link href={`/?projectId=${project?.id}`}>
                        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md flex items-center gap-2 hover:bg-primary/90 transition text-sm">
                            <Plus size={16} /> New Analysis
                        </button>
                    </Link>
                </div>

                {project?.analyses && project.analyses.length > 0 ? (
                    <div className="grid gap-4">
                        {project.analyses.map(analysis => (
                            <Link key={analysis.id} href={`/analysis/${analysis.id}`}>
                                <div className="p-4 border rounded-lg hover:bg-muted/50 transition">
                                    <div className="flex justify-between items-center mb-1">
                                        <h3 className="font-medium">{analysis.title || `Analysis ${analysis.version}`}</h3>
                                        <span className="text-xs text-muted-foreground">v{analysis.version}</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground line-clamp-1">
                                        {cleanInputText(analysis.inputText || "")}
                                    </p>
                                    <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                                        <span>{format(new Date(analysis.createdAt), 'MMM d, h:mm a')}</span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <p className="text-muted-foreground italic">No analyses in this project yet.</p>
                )}
            </div>
        </div>
    );
}
