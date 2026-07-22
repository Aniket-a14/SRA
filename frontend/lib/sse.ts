/**
 * Reads a `text/event-stream` response body via fetch() + ReadableStream, not native
 * EventSource — EventSource can't set the Authorization header these endpoints
 * require, and putting the JWT in the URL would leak it into server/proxy access logs.
 *
 * Shared by useAnalysisProgress (pipeline progress) and the chat streaming panel.
 */
export async function readSSEStream(
    response: Response,
    onEvent: (data: unknown) => void,
    signal?: AbortSignal
): Promise<void> {
    if (!response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (!signal?.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sepIndex;
        while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
            const rawEvent = buffer.slice(0, sepIndex);
            buffer = buffer.slice(sepIndex + 2);

            const dataLine = rawEvent.split("\n").find(line => line.startsWith("data: "));
            if (!dataLine) continue; // heartbeat comment lines, etc.

            try {
                onEvent(JSON.parse(dataLine.slice("data: ".length)));
            } catch {
                // malformed chunk — ignore, connection stays open for the next event
            }
        }
    }
}
