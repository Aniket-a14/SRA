import { Project, PromptSettings } from "@/types/project";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

async function handleResponse(res: Response) {
    if (!res.ok) {
        let errorMessage = res.statusText;
        try {
            const errorData = await res.json();
            errorMessage = errorData.error || errorData.message || res.statusText;
        } catch {
            // Ignore JSON parse error, fallback to statusText
        }
        throw new Error(errorMessage);
    }
    return res;
}

export async function fetchProjects(token: string): Promise<Project[]> {
    const res = await fetch(`${BACKEND_URL}/projects`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    await handleResponse(res);
    const json = await res.json();
    return json.data || json;
}

export async function fetchProject(token: string, id: string): Promise<Project> {
    const res = await fetch(`${BACKEND_URL}/projects/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    await handleResponse(res);
    const json = await res.json();
    return json.data || json;
}

export async function createProject(token: string, data: { name: string; description?: string }, csrfToken?: string | null): Promise<Project> {
    const res = await fetch(`${BACKEND_URL}/projects`, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(csrfToken && { "x-csrf-token": csrfToken })
        },
        body: JSON.stringify(data)
    });
    await handleResponse(res);
    const json = await res.json();
    return json.data || json;
}

export async function updateProject(token: string, id: string, data: { name?: string; description?: string; settings?: PromptSettings }, csrfToken?: string | null): Promise<Project> {
    const res = await fetch(`${BACKEND_URL}/projects/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(csrfToken && { "x-csrf-token": csrfToken })
        },
        body: JSON.stringify(data)
    });
    await handleResponse(res);
    const json = await res.json();
    return json.data || json;
}

export async function deleteProject(token: string, id: string, csrfToken?: string | null): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/projects/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
            Authorization: `Bearer ${token}`,
            ...(csrfToken && { "x-csrf-token": csrfToken })
        }
    });
    await handleResponse(res);
}
