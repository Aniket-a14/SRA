/**
 * Production-grade drain-aware Server-Sent Events (SSE) stream dispatcher.
 * Handles backpressure via the 'drain' event and provides periodic keep-alive heartbeats.
 */
export function createSSEStream(res, req, options = {}) {
    const { heartbeatIntervalMs = 15000 } = options;

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    });

    // Flush headers immediately
    if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
    }

    let isClosed = false;

    // Send keep-alive heartbeat comments to prevent proxy 504 timeouts
    const heartbeatTimer = setInterval(() => {
        if (!isClosed) {
            try {
                res.write(': keep-alive\n\n');
            } catch {
                cleanup();
            }
        }
    }, heartbeatIntervalMs);

    const cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        clearInterval(heartbeatTimer);
    };

    req.on('close', cleanup);
    req.on('error', cleanup);
    res.on('close', cleanup);
    res.on('error', cleanup);

    /**
     * Writes an SSE payload respecting TCP/kernel socket backpressure.
     */
    const writeEvent = async (event, data = null) => {
        if (isClosed) return false;

        let payload = '';
        if (data === null && typeof event === 'object') {
            payload = `data: ${JSON.stringify(event)}\n\n`;
        } else if (data !== null) {
            payload = `event: ${event}\ndata: ${typeof data === 'object' ? JSON.stringify(data) : data}\n\n`;
        } else {
            payload = `data: ${event}\n\n`;
        }

        try {
            const canWrite = res.write(payload);
            if (!canWrite && !isClosed) {
                await new Promise(resolve => {
                    const onDrain = () => {
                        cleanupListener();
                        resolve();
                    };
                    const onClose = () => {
                        cleanupListener();
                        resolve();
                    };
                    const cleanupListener = () => {
                        res.off('drain', onDrain);
                        res.off('close', onClose);
                    };
                    res.once('drain', onDrain);
                    res.once('close', onClose);
                });
            }
            return true;
        } catch {
            cleanup();
            return false;
        }
    };

    const close = () => {
        cleanup();
        try {
            if (typeof res.end === 'function') {
                res.end();
            }
        } catch (_err) {
            // Ignore stream close error on already terminated response
        }
    };

    return {
        writeEvent,
        close,
        isClosed: () => isClosed
    };
}
