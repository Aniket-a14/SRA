import { DFDInput } from "@/components/DFDViewer";

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

export async function generateDFD(token: string, data: { projectName: string; description: string; srsContent?: string }, csrfToken?: string | null): Promise<DFDInput> {
    const res = await fetch(`${BACKEND_URL}/analyze/generate-dfd`, {
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
    return json.srs;
}
