/**
 * Time budget for a single worker invocation of the analysis pipeline.
 *
 * The pipeline needs roughly 360s end to end, but a Vercel function is killed at 300s
 * (the hard maximum on Hobby — see backend/vercel.json). Rather than split the
 * orchestrator into fixed stages, each invocation runs as many *checkpointed* stages as
 * fit inside this budget, then persists its checkpoint and re-enqueues itself through
 * QStash. The next invocation resumes exactly where this one stopped.
 *
 * Fixed stages would be the more obvious design, but stage durations vary by an order of
 * magnitude (a Reviewer pass is seconds, a sectional Developer run is minutes) and shift
 * with model and document size. A deadline adapts to whatever the run actually costs, and
 * keeps working unchanged if the platform limit or the pipeline shape changes.
 */

/**
 * How long one invocation may run before yielding. Deliberately below the platform limit:
 * the remaining headroom covers the checkpoint write and the QStash publish that hand work
 * to the next invocation. Yielding late enough to be killed mid-handoff would lose the
 * chain and leave the row stranded IN_PROGRESS until the reconciliation sweep.
 */
const DEFAULT_BUDGET_MS = 240000; // 240s of a 300s ceiling, leaving 60s of headroom

export const STAGE_BUDGET_MS = Number(process.env.PIPELINE_STAGE_BUDGET_MS) || DEFAULT_BUDGET_MS;

/**
 * Signals that the invocation ran out of budget with work still to do. Not a failure: the
 * checkpoint is saved and the run continues in the next invocation, so the worker converts
 * this into a continuation rather than marking the analysis FAILED.
 */
export class PipelinePausedError extends Error {
    constructor(stage) {
        super(`Pipeline paused after "${stage}" to stay within the function time limit; continuing in the next invocation.`);
        this.name = 'PipelinePausedError';
        this.paused = true;
        this.stage = stage;
    }
}

/**
 * Build a deadline checker for one invocation.
 *
 * @param {number} [budgetMs] - override the default budget (tests, other platforms)
 * @returns {{ exceeded: () => boolean, remainingMs: () => number, assertBudget: (stage: string) => void }}
 */
export function createStageBudget(budgetMs = STAGE_BUDGET_MS) {
    const startedAt = Date.now();
    const deadline = startedAt + budgetMs;

    const remainingMs = () => deadline - Date.now();
    const exceeded = () => remainingMs() <= 0;

    return {
        remainingMs,
        exceeded,
        /**
         * Call immediately after a checkpoint write. Throws PipelinePausedError when the
         * budget is spent, which is safe precisely because the checkpoint is already
         * durable — nothing completed is lost by stopping here.
         *
         * @param {string} stage - the stage just completed, for logs and telemetry
         */
        assertBudget(stage) {
            if (exceeded()) throw new PipelinePausedError(stage);
        }
    };
}
