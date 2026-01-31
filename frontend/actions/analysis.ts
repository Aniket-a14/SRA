"use server";

import { z } from "zod";
import { PromptSettings } from "@/types/project";

const AnalysisSchema = z.object({
    requirements: z.string().min(1, "Requirements are required"),
    projectName: z.string().min(1, "Project name is required"),
    projectId: z.string().optional(),
    settings: z.any().optional(), // PromptSettings
    token: z.string().min(1, "Authentication required"),
});

export type AnalysisActionState = {
    error?: string;
    success?: boolean;
    id?: string;
    pending?: boolean;
};

import { cookies } from "next/headers";

export async function createAnalysisAction(
    prevState: AnalysisActionState,
    formData: FormData
): Promise<AnalysisActionState> {
    const cookieStore = await cookies();
    const cookieString = cookieStore.toString();
    const token = formData.get("token") as string;
    const requirements = formData.get("requirements") as string;
    const projectName = formData.get("projectName") as string;
    const projectId = formData.get("projectId") as string;
    const settingsRaw = formData.get("settings") as string;
    const csrfToken = formData.get("csrfToken") as string;

    let settings: PromptSettings | undefined;
    try {
        settings = settingsRaw ? JSON.parse(settingsRaw) : undefined;
    } catch (e) {
        console.warn("Failed to parse settings in action", e);
    }

    const validatedFields = AnalysisSchema.safeParse({
        token,
        requirements,
        projectName,
        projectId: projectId || undefined,
        settings,
    });

    if (!validatedFields.success) {
        return {
            error: "Invalid input fields. Please check your project name and description.",
        };
    }

    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                Cookie: cookieString,
                ...(csrfToken && { "x-csrf-token": csrfToken })
            },
            body: JSON.stringify({
                text: requirements,
                srsData: {
                    introduction: {
                        projectName: { content: projectName },
                        purpose: { content: requirements },
                    },
                },
                projectId: projectId || undefined,
                settings: settings || undefined,
                draft: true,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return {
                error: errorData.error || "Failed to initialize project. Please try again.",
            };
        }

        const json = await response.json();
        const data = json.data || json;

        if (data.status === "draft" && data.id) {
            // We don't redirect inside the action if we want to handle it in the component 
            // OR we can use redirect() but it throws an error that Next.js catches.
            // For better UX with toast, we return the ID.
            return { success: true, id: data.id };
        }

        return { error: "Unexpected response from server." };
    } catch (error) {
        console.error("Action error:", error);
        return { error: "Network error occurred. Please check your connection." };
    }
}
