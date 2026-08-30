import { describe, it, expect, jest } from '@jest/globals';
import { reciprocalRankFusion } from '../../src/services/knowledge/rerankService.js';
import { createReviewSnapshot, stringifyForPrompt } from '../../src/utils/promptCompaction.js';
import { normalizeScore, isApprovedStatus } from '../../src/services/pipeline/reflectionStage.js';
import { recordStreamMetrics, getTelemetrySnapshot } from '../../src/utils/telemetry.js';
import { createSSEStream } from '../../src/utils/sseWriter.js';
import { EventEmitter } from 'events';

describe('SRA 29-Parameter Architecture Verification Suite', () => {

    describe('Parameter 1 & 8 & 27: RRF Hybrid Reranking Engine', () => {
        it('merges dense and sparse search lists using Reciprocal Rank Fusion', () => {
            const denseList = [
                { id: 'chunk-1', similarity: 0.95, qualityScore: 0.8 },
                { id: 'chunk-2', similarity: 0.85, qualityScore: 0.8 },
            ];
            const sparseList = [
                { id: 'chunk-2', lexicalRank: 0.99, qualityScore: 0.8 },
                { id: 'chunk-3', lexicalRank: 0.80, qualityScore: 0.8 },
            ];

            const reranked = reciprocalRankFusion(denseList, sparseList);
            expect(reranked.length).toBe(3);
            // chunk-2 appears in both dense and sparse, so its combined RRF reciprocal rank should be highest
            expect(reranked[0].id).toBe('chunk-2');
            expect(reranked[0].finalScore).toBeGreaterThan(reranked[1].finalScore);
        });
    });

    describe('Parameter 10: Hierarchical AST-Aware Context Compaction', () => {
        it('preserves ALL features without lossy truncation of features > 12', () => {
            const features = Array.from({ length: 25 }, (_, i) => ({
                name: `Feature ${i + 1}`,
                priority: 'High',
                description: `Detailed description for feature ${i + 1}`,
                functionalRequirements: [`FR-${i + 1}.1`, `FR-${i + 1}.2`]
            }));

            const snapshot = createReviewSnapshot(
                { projectTitle: 'Large Project', features },
                { projectTitle: 'Large Project', systemFeatures: features }
            );

            expect(snapshot.srsDraft.systemFeatureCount).toBe(25);
            expect(snapshot.srsDraft.systemFeatures.length).toBe(25);
            expect(snapshot.originalIntent.features.length).toBe(25);
        });

        it('truncates cleanly without word-slicing corruption', () => {
            const longText = 'First sentence here. Second sentence starts here and continues for a very long duration.';
            const formatted = stringifyForPrompt(longText, 30);
            expect(formatted).toBe('First sentence here.');
        });
    });

    describe('Parameter 21: Monotonic Quality Gate & Normalization', () => {
        it('properly rescales fractional critic scores to 0-100', () => {
            expect(normalizeScore(0.88, { clarity: 0.88, completeness: 0.85 })).toBe(88);
            expect(normalizeScore(8.5, { clarity: 8.5, completeness: 9.0 })).toBe(85);
            expect(normalizeScore(92)).toBe(92);
        });

        it('recognizes approved reviewer statuses case-insensitively', () => {
            expect(isApprovedStatus('APPROVED')).toBe(true);
            expect(isApprovedStatus('Approved')).toBe(true);
            expect(isApprovedStatus('APPROVED_WITH_COMMENTS')).toBe(true);
            expect(isApprovedStatus('PASS')).toBe(true);
            expect(isApprovedStatus('REJECTED')).toBe(false);
        });
    });

    describe('Parameter 22: Time-To-First-Token (TTFT) Telemetry', () => {
        it('records and computes p50, p95, p99 stream percentiles', () => {
            recordStreamMetrics({ provider: 'google', modelName: 'gemini-2.5-flash', ttftMs: 350, totalMs: 1200, tokenCount: 450 });
            recordStreamMetrics({ provider: 'google', modelName: 'gemini-2.5-flash', ttftMs: 400, totalMs: 1400, tokenCount: 500 });
            recordStreamMetrics({ provider: 'google', modelName: 'gemini-2.5-flash', ttftMs: 800, totalMs: 2500, tokenCount: 600 });

            const snapshot = getTelemetrySnapshot();
            expect(snapshot.ttft.count).toBeGreaterThanOrEqual(3);
            expect(snapshot.ttft.p50).toBeGreaterThanOrEqual(350);
            expect(snapshot.tokenRate.p50).toBeGreaterThan(0);
        });
    });

    describe('Parameter 4 & 9: Drain-Aware SSE Stream Backpressure', () => {
        it('initializes SSE headers and handles event dispatching', async () => {
            const req = new EventEmitter();
            const res = new EventEmitter();
            res.writeHead = jest.fn();
            res.write = jest.fn().mockReturnValue(true);
            res.end = jest.fn();

            const sse = createSSEStream(res, req, { heartbeatIntervalMs: 100000 });
            expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform'
            }));

            const written = await sse.writeEvent('progress', { stage: 'po', percent: 20 });
            expect(written).toBe(true);
            expect(res.write).toHaveBeenCalledWith(expect.stringContaining('event: progress'));

            sse.close();
            expect(res.end).toHaveBeenCalled();
        });
    });
});
