import axios from 'axios';
import { configManager } from '../config/config-manager.js';
import { logger } from '../utils/logger.js';

const DEFAULT_TRUSTED_HOSTS = [
    'sra-backend-six.vercel.app',
    'localhost',
    '127.0.0.1'
];

export const DEFAULT_BACKEND_URL = 'https://sra-backend-six.vercel.app';

// A single analysis stage can take minutes on the platform side, but every *request* the
// CLI makes is a short control-plane call — the long wait happens on the progress stream,
// which opts out of the timeout entirely.
const DEFAULT_TIMEOUT_MS = 30000;

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRYABLE_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'EAI_AGAIN', 'ENOTFOUND']);
const MAX_RETRIES = 3;

// Only send the bearer token to a host we recognize — a tampered/malicious
// sra.config.json (e.g. checked into a shared repo, or a committed workspace) with a
// different backendUrl should not silently exfiltrate the user's live API token.
const isTrustedHost = (baseURL) => {
    if (process.env.SRA_ALLOW_UNTRUSTED_HOST === 'true') return true;
    try {
        const { hostname } = new URL(baseURL);
        const extraTrusted = (process.env.SRA_TRUSTED_HOSTS || '')
            .split(',')
            .map(h => h.trim())
            .filter(Boolean);
        return [...DEFAULT_TRUSTED_HOSTS, ...extraTrusted].includes(hostname);
    } catch {
        return false;
    }
};

/**
 * Human-readable reason for a failed request.
 *
 * The API returns errors in more than one envelope (`{message}`, `{error}`, plain text),
 * and axios's own `error.message` for an HTTP failure is only ever "Request failed with
 * status code 4xx" — useless on its own. Commands log this instead so the user sees what
 * the server actually said.
 */
export function describeError(error) {
    const data = error?.response?.data;

    // 401 is the CLI's most common failure and its server text ("Unauthorized access")
    // never says what to do about it. The fix is always the same, so name it.
    if (error?.response?.status === 401) {
        return 'Unauthorized — SRA_API_KEY is missing, expired or revoked. Generate a new key in the web app under Settings.';
    }
    if (error?.response?.status === 429) {
        return 'Rate limited — the platform asked the CLI to slow down. Retry in a moment.';
    }

    if (typeof data === 'string' && data.trim()) return data.trim();
    if (data && typeof data === 'object') {
        const detail = data.message || data.error || data.details;
        if (typeof detail === 'string' && detail) return detail;
        if (detail) return JSON.stringify(detail);
    }

    if (error?.code === 'ECONNREFUSED') return 'Connection refused — the backend is unreachable.';
    if (error?.code === 'ECONNABORTED') return 'Request timed out.';
    return error?.message || 'Unknown error';
}

/** HTTP status of a failed request, or null for network-level failures. */
export const statusOf = (error) => error?.response?.status ?? null;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const isRetryable = (error) => {
    const status = statusOf(error);
    if (status !== null) return RETRYABLE_STATUS.has(status);
    return RETRYABLE_CODES.has(error?.code);
};

/**
 * Delay before the next attempt. Honours `Retry-After` when the server sends one — the
 * platform's rate limiter does, and guessing shorter than it asks just burns the quota
 * the header was trying to protect.
 */
const backoffMs = (error, attempt) => {
    const header = error?.response?.headers?.['retry-after'];
    if (header) {
        const seconds = Number(header);
        if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 60000);
    }
    // Jittered exponential: 1s, 2s, 4s ± 25%, matching the backend's own retry shape.
    const base = 1000 * (2 ** (attempt - 1));
    return Math.round(base * (0.75 + Math.random() * 0.5));
};

class ApiClient {
    constructor() {
        this.client = axios.create({
            timeout: DEFAULT_TIMEOUT_MS,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'SRA-CLI/Enterprise'
            }
        });

        this._setupInterceptors();
    }

    _setupInterceptors() {
        // Request Interceptor: Inject Token & BaseURL
        this.client.interceptors.request.use(async (config) => {
            const sraConfig = await configManager.load();

            // Priority: Local Config > Env Var > Default
            if (!config.baseURL) {
                config.baseURL = sraConfig.backendUrl || process.env.SRA_BACKEND_URL || DEFAULT_BACKEND_URL;
            }

            // Authentication Fallback
            const token = sraConfig.token || process.env.SRA_API_KEY;
            if (token && !config.headers.Authorization) {
                if (isTrustedHost(config.baseURL)) {
                    config.headers.Authorization = `Bearer ${token}`;
                } else {
                    logger.warn(`Refusing to send API token to untrusted host: ${config.baseURL}. Set SRA_TRUSTED_HOSTS or SRA_ALLOW_UNTRUSTED_HOST=true if this is intentional.`);
                }
            }

            logger.debug(`Outgoing Request: ${config.method.toUpperCase()} ${config.url}`);
            return config;
        });

        // Response Interceptor: Global Error Handling
        this.client.interceptors.response.use(
            (response) => {
                logger.debug(`Response received from ${response.config.url}`);
                return response.data; // Flatten response
            },
            (error) => {
                // Debug, not error: every command reports the failure itself with the
                // context of what it was doing. Logging here as well printed two lines for
                // one problem, the generic one first.
                logger.debug(`Request failed (${statusOf(error) ?? 'network'}): ${describeError(error)}`);
                return Promise.reject(error);
            }
        );
    }

    /**
     * Issue a request, retrying transient failures. Only idempotent verbs retry: replaying
     * a POST that already reached the server would enqueue a second analysis and bill the
     * user's own provider key twice.
     */
    async _request(config, { retry = false } = {}) {
        const attempts = retry ? MAX_RETRIES : 1;
        let lastError;

        for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
                return await this.client.request(config);
            } catch (error) {
                lastError = error;
                if (attempt === attempts || !isRetryable(error)) break;

                const wait = backoffMs(error, attempt);
                logger.debug(`Retrying ${String(config.method).toUpperCase()} ${config.url} in ${wait}ms (attempt ${attempt + 1}/${attempts})`);
                await sleep(wait);
            }
        }

        throw lastError;
    }

    async get(url, config = {}) {
        return this._request({ ...config, method: 'get', url }, { retry: true });
    }

    async post(url, data, config = {}) {
        return this._request({ ...config, method: 'post', url, data });
    }

    async put(url, data, config = {}) {
        return this._request({ ...config, method: 'put', url, data }, { retry: true });
    }

    async delete(url, config = {}) {
        return this._request({ ...config, method: 'delete', url }, { retry: true });
    }

    /**
     * Open a long-lived server-sent-events response and return the raw Node stream.
     *
     * No timeout and no retry: the pipeline publishes progress minutes apart, so a timeout
     * would kill a healthy connection, and a silent reconnect would replay nothing — the
     * caller decides how to recover.
     */
    async stream(url, config = {}) {
        return this._request({
            ...config,
            method: 'get',
            url,
            responseType: 'stream',
            timeout: 0,
            headers: { Accept: 'text/event-stream', ...(config.headers || {}) }
        });
    }
}

export const api = new ApiClient();
