/** Throws with the backend's `{ error }`/`{ message }` body on a non-2xx response, falling back to statusText. */
export async function handleResponse(res: Response): Promise<Response> {
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
