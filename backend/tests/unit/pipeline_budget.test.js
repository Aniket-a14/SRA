import { describe, it, expect } from '@jest/globals';
import { createStageBudget, PipelinePausedError, STAGE_BUDGET_MS } from '../../src/services/pipelineBudget.js';

describe('createStageBudget', () => {
    it('allows stages through while budget remains', () => {
        const budget = createStageBudget(60000);

        expect(budget.exceeded()).toBe(false);
        expect(() => budget.assertBudget('product_owner')).not.toThrow();
        expect(budget.remainingMs()).toBeGreaterThan(0);
    });

    it('yields once the budget is spent', () => {
        // A zero budget is already past its deadline on the first check.
        const budget = createStageBudget(0);

        expect(budget.exceeded()).toBe(true);
        expect(() => budget.assertBudget('architect')).toThrow(PipelinePausedError);
    });

    it('names the completed stage so the continuation is traceable', () => {
        const budget = createStageBudget(0);

        const error = (() => {
            try { budget.assertBudget('developer_draft'); } catch (e) { return e; }
        })();

        expect(error.stage).toBe('developer_draft');
        expect(error.paused).toBe(true);
        expect(error.message).toMatch(/developer_draft/);
    });

    it('leaves headroom under the 300s platform ceiling for the handoff', () => {
        // The checkpoint write and QStash publish happen AFTER the budget is spent, so a
        // default at or above the function limit would be killed mid-handoff and strand
        // the run IN_PROGRESS.
        expect(STAGE_BUDGET_MS).toBeLessThan(300000);
        expect(STAGE_BUDGET_MS).toBeGreaterThanOrEqual(60000);
    });
});

describe('PipelinePausedError', () => {
    it('is distinguishable from a genuine pipeline failure', () => {
        // analysisService re-throws on `paused` before its failure handling, and the worker
        // branches on the same flag. A plain Error must never be mistaken for a pause.
        expect(new PipelinePausedError('rag_retrieval').paused).toBe(true);
        expect(new Error('AI Analysis execution failed').paused).toBeUndefined();
    });
});
