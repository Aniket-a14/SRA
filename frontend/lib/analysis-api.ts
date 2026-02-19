import { DFDInput } from "@/components/DFDViewer";
import { StartAnalysisInput, UpdateAnalysisInput } from "@/types/analysis";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

async function handleResponse(res: Response) {
    if (!res.ok) {
        let errorMessage = res.statusText;
        try {
            const errorData = await res.json();
            // Backend sends { error: "Message", code: "CODE" }
            errorMessage = errorData.error || errorData.message || res.statusText;
        } catch {
            // Ignore JSON parse error, fallback to statusText
        }
        throw new Error(errorMessage);
    }
    return res;
}

export async function generateDFD(token: string, data: { projectName: string; description: string; srsContent?: string }): Promise<DFDInput> {
    const res = await fetch(`${BACKEND_URL}/analyze/generate-dfd`, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
    });
    await handleResponse(res);
    const json = await res.json();
    return (json.data && json.data.srs) ? json.data.srs : json.srs;
}

// -- New centralized methods --

export async function updateAnalysis(id: string, token: string, data: UpdateAnalysisInput) {
    const res = await fetch(`${BACKEND_URL}/analyze/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
    });
    await handleResponse(res);
    return await res.json();
}

export async function runValidation(id: string, token: string) {
    const res = await fetch(`${BACKEND_URL}/analyze/${id}/validate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
    });
    await handleResponse(res);
    return await res.json();
}

export async function autoFixIssue(id: string, token: string, issueId: string) {
    const res = await fetch(`${BACKEND_URL}/analyze/${id}/auto-fix`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ issueId })
    });
    await handleResponse(res);
    return await res.json();
}

export async function startAnalysis(token: string, data: StartAnalysisInput) {
    const res = await fetch(`${BACKEND_URL}/analyze`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
    });
    await handleResponse(res);
    return await res.json();
}

export async function finalizeAnalysis(id: string, token: string) {
    const res = await fetch(`${BACKEND_URL}/analyze/${id}/finalize`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
    });
    await handleResponse(res); // throws if not ok
    return true;
}
