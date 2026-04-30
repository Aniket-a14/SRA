import { DFDInput } from "@/components/DFDViewer";
import { StartAnalysisInput, UpdateAnalysisInput } from "@/types/analysis";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

// Default timeout for standard API calls (15s)
const DEFAULT_TIMEOUT_MS = 15_000;
// Extended timeout for AI-heavy calls (validation, DFD gen, auto-fix)
const AI_TIMEOUT_MS = 120_000;

/**
 * Create a fetch wrapper with AbortController timeout.
 * Prevents hung UI when the backend is slow or unreachable.
 */
function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    return fetch(url, {
        ...options,
        signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));
}

async function handleResponse(res: Response) {
    if (!res.ok) {
        let errorMessage = res.statusText;
        try {
            const cloned = res.clone();
            const errorData = await cloned.json();
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
    const res = await fetchWithTimeout(`${BACKEND_URL}/analyze/generate-dfd`, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
    }, AI_TIMEOUT_MS);
    await handleResponse(res);
    const json = await res.json();
    return (json.data && json.data.srs) ? json.data.srs : json.srs;
}

// -- New centralized methods --

export async function updateAnalysis(id: string, token: string, data: UpdateAnalysisInput) {
    const res = await fetchWithTimeout(`${BACKEND_URL}/analyze/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
    }, DEFAULT_TIMEOUT_MS);
    await handleResponse(res);
    return await res.json();
}

export async function runValidation(id: string, token: string) {
    const res = await fetchWithTimeout(`${BACKEND_URL}/analyze/${id}/validate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
    }, AI_TIMEOUT_MS);
    await handleResponse(res);
    return await res.json();
}

export async function autoFixIssue(id: string, token: string, issueId: string) {
    const res = await fetchWithTimeout(`${BACKEND_URL}/analyze/${id}/auto-fix`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ issueId })
    }, AI_TIMEOUT_MS);
    await handleResponse(res);
    return await res.json();
}

export async function startAnalysis(token: string, data: StartAnalysisInput) {
    const res = await fetchWithTimeout(`${BACKEND_URL}/analyze`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
    }, DEFAULT_TIMEOUT_MS);
    await handleResponse(res);
    return await res.json();
}

export async function finalizeAnalysis(id: string, token: string) {
    const res = await fetchWithTimeout(`${BACKEND_URL}/analyze/${id}/finalize`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
    }, AI_TIMEOUT_MS);
    await handleResponse(res); // throws if not ok
    return true;
}
