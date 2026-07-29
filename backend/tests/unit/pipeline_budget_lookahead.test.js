import { describe, it, expect } from '@jest/globals';

/**
 * A production run on 2026-07-29 checkpointed its draft 220s in, passed the "am I past the
 * deadline?" check because 220 < 240, then spent the next 80 seconds in the reflection loop
 * and was killed by the platform at 300s. Its last checkpoint was already stale, the row
 * stayed IN_PROGRESS, and the page sat on the stage it had last been told about.
 *
 * The deadline has to be read against the work ahead, not only the work behind.
 */

const { createStageBudget, STAGE_COST_MS, PipelinePausedError } =
    await import('../../src/services/pipelineBudget.js');

describe('createStageBudget.assertBudgetFor', () => {
    it('starts a stage that fits in the time left', () => {
        const budget = createStageBudget(240000);
        expect(() => budget.assertBudgetFor('developer_draft', 20000)).not.toThrow();
    });

    it('yields when the next stage does not fit, even though the deadline has not passed', () => {
        // 30s of budget left, and a reflection pass costs 90s. assertBudget would allow this.
        const budget = createStageBudget(30000);
        expect(() => budget.assertBudget('developer_draft')).not.toThrow();
        expect(() => budget.assertBudgetFor('developer_draft', STAGE_COST_MS.reflection_pass))
            .toThrow(PipelinePausedError);
    });

    it('names the completed stage on the pause, so the run resumes from the right place', () => {
        const budget = createStageBudget(0);
        try {
            budget.assertBudgetFor('diagram_repair', STAGE_COST_MS.reflection_pass);
            throw new Error('expected a pause');
        } catch (error) {
            expect(error.paused).toBe(true);
            expect(error.stage).toBe('diagram_repair');
        }
    });

    it('reproduces the run that timed out: the tail no longer starts inside a spent budget', () => {
        // The observed shape — 220s gone of a 240s budget against a 300s platform ceiling.
        const budget = createStageBudget(240000 - 220000);

        // Old behaviour: past-the-deadline only, so the 90s reflection loop was allowed to start.
        expect(() => budget.assertBudget('developer_draft')).not.toThrow();

        // New behaviour: it is handed to the next invocation instead of running into the wall.
        expect(() => budget.assertBudgetFor('developer_draft', STAGE_COST_MS.reflection_pass))
            .toThrow(PipelinePausedError);
    });

    it('refuses any stage it cannot fund in full', () => {
        // The guarantee the look-ahead buys: a stage either fits inside the budget or does not
        // start, so the run finishes by the deadline rather than the deadline plus one stage.
        for (const cost of Object.values(STAGE_COST_MS)) {
            expect(() => createStageBudget(cost - 1).assertBudgetFor('stage', cost))
                .toThrow(PipelinePausedError);
            expect(() => createStageBudget(cost + 5000).assertBudgetFor('stage', cost))
                .not.toThrow();
        }
    });

    it('leaves the default budget enough headroom under the 300s function limit', async () => {
        // backend/vercel.json caps a function at 300s. The budget is what a stage may finish
        // by; the gap covers the checkpoint write and the QStash publish that hand the run on.
        const { STAGE_BUDGET_MS } = await import('../../src/services/pipelineBudget.js');
        expect(STAGE_BUDGET_MS).toBeLessThanOrEqual(300000 - 30000);
    });
});
