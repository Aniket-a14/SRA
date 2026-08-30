import logger from '../config/logger.js';

/**
 * In-process latency & TTFT telemetry recorder.
 * Tracks p50, p95, p99 percentiles and token throughput per model provider.
 */

const metricsStore = {
    ttftSamples: [], // ms to first token
    totalLatencySamples: [], // ms total duration
    tokenRateSamples: [], // tokens per second
};

const MAX_SAMPLES = 500;

export function recordStreamMetrics({ provider, modelName, ttftMs, totalMs, tokenCount }) {
    if (ttftMs !== null && ttftMs > 0) {
        metricsStore.ttftSamples.push(ttftMs);
        if (metricsStore.ttftSamples.length > MAX_SAMPLES) metricsStore.ttftSamples.shift();
    }

    if (totalMs !== null && totalMs > 0) {
        metricsStore.totalLatencySamples.push(totalMs);
        if (metricsStore.totalLatencySamples.length > MAX_SAMPLES) metricsStore.totalLatencySamples.shift();
    }

    if (tokenCount > 0 && totalMs > 0) {
        const tokensPerSec = (tokenCount / (totalMs / 1000));
        metricsStore.tokenRateSamples.push(tokensPerSec);
        if (metricsStore.tokenRateSamples.length > MAX_SAMPLES) metricsStore.tokenRateSamples.shift();
    }

    logger.debug({
        msg: '[Stream Telemetry]',
        provider,
        modelName,
        ttftMs: Math.round(ttftMs || 0),
        totalMs: Math.round(totalMs || 0),
        tokens: tokenCount,
        tokPerSec: Math.round((tokenCount / (totalMs / 1000)) || 0)
    });
}

function calculatePercentiles(samples) {
    if (samples.length === 0) return { p50: 0, p95: 0, p99: 0, count: 0 };
    const sorted = [...samples].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    return { p50, p95, p99, count: samples.length };
}

export function getTelemetrySnapshot() {
    return {
        ttft: calculatePercentiles(metricsStore.ttftSamples),
        totalLatency: calculatePercentiles(metricsStore.totalLatencySamples),
        tokenRate: calculatePercentiles(metricsStore.tokenRateSamples)
    };
}
