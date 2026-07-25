import { api, describeError } from '../api/api-client.js';
import { logger } from '../utils/logger.js';

const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED']);
const POLL_INTERVAL_MS = 5000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Follow a running analysis to completion.
 *
 * Live progress comes over the platform's SSE channel, the same one the web workspace
 * consumes, so the CLI reports the pipeline's real stage rather than a spinner. Redis
 * backs that channel and is explicitly best-effort on the server, so this degrades to
 * polling the job endpoint whenever the stream is unavailable or drops.
 *
 * @param {string} analysisId
 * @param {{ onStage?: (event: object) => void, timeoutMs?: number }} [options]
 * @returns {Promise<{status: string, resultQuality?: string}>}
 */
export async function followAnalysis(analysisId, { onStage = () => {}, timeoutMs = 45 * 60 * 1000 } = {}) {
    const deadline = Date.now() + timeoutMs;

    const streamed = await streamProgress(analysisId, onStage, deadline);
    if (streamed) return streamed;

    logger.debug('Live progress unavailable — falling back to polling.');
    return pollUntilDone(analysisId, onStage, deadline);
}

/**
 * Consume the SSE endpoint. Resolves with the terminal state, or null when the stream
 * could not carry the run to completion (so the caller can poll instead).
 */
async function streamProgress(analysisId, onStage, deadline) {
    let stream;
    try {
        stream = await api.stream(`/api/analyze/${analysisId}/stream`);
    } catch (error) {
        logger.debug(`Progress stream refused: ${describeError(error)}`);
        return null;
    }

    return new Promise((resolve) => {
        let buffer = '';
        let settled = false;

        const finish = (value) => {
            if (settled) return;
            settled = true;
            clearInterval(watchdog);
            stream.destroy();
            resolve(value);
        };

        // The server sends a comment heartbeat every 15s; a long gap means the connection
        // is dead in a way Node won't surface, since an idle HTTP stream never errors.
        let lastActivity = Date.now();
        const watchdog = setInterval(() => {
            if (Date.now() > deadline) finish({ status: 'TIMEOUT' });
            else if (Date.now() - lastActivity > 90000) finish(null);
        }, 5000);

        stream.on('data', (chunk) => {
            lastActivity = Date.now();
            buffer += chunk.toString('utf-8');

            // SSE frames are separated by a blank line; a chunk can split one in half.
            const frames = buffer.split('\n\n');
            buffer = frames.pop() ?? '';

            for (const frame of frames) {
                const payload = frame
                    .split('\n')
                    .filter(line => line.startsWith('data:'))
                    .map(line => line.slice(5).trim())
                    .join('');
                if (!payload) continue; // heartbeat comment

                let event;
                try {
                    event = JSON.parse(payload);
                } catch {
                    continue;
                }

                onStage(event);

                if (event.stage === 'unavailable') {
                    finish(null);
                    return;
                }
                if (event.terminal) {
                    finish({ status: event.status || 'COMPLETED', resultQuality: event.resultQuality });
                    return;
                }
            }
        });

        stream.on('error', (error) => {
            logger.debug(`Progress stream error: ${error.message}`);
            finish(null);
        });

        // A clean end without a terminal event means the run is still going (a paused
        // invocation, a proxy closing an idle connection) — poll rather than claim done.
        stream.on('end', () => finish(null));
    });
}

async function pollUntilDone(analysisId, onStage, deadline) {
    let lastStatus = null;

    while (Date.now() < deadline) {
        let job;
        try {
            const response = await api.get(`/api/analyze/job/${analysisId}`);
            job = response?.data || response;
        } catch (error) {
            logger.debug(`Poll failed: ${describeError(error)}`);
            await sleep(POLL_INTERVAL_MS);
            continue;
        }

        if (job?.status && job.status !== lastStatus) {
            lastStatus = job.status;
            onStage({ stage: job.status.toLowerCase(), message: `Status: ${job.status}` });
        }

        if (TERMINAL_STATUSES.has(job?.status)) {
            return { status: job.status, resultQuality: job.resultQuality };
        }

        await sleep(POLL_INTERVAL_MS);
    }

    return { status: 'TIMEOUT' };
}

/** Human label for a pipeline stage id, for the progress line. */
export function describeStage(event) {
    if (event.message) return event.message;
    const stage = String(event.stage || '').replace(/_/g, ' ');
    return stage ? stage.charAt(0).toUpperCase() + stage.slice(1) : 'Working...';
}
