export const TEMPERATURES = Object.freeze({
    productOwner: 0.7, // Discovery benefits from mild expansion, still constrained by traceability rules.
    architect: 0.4, // Architecture should be deterministic while allowing domain modeling judgment.
    developer: 0.4, // SRS prose needs consistency more than creativity.
    developerRequirements: 0.5, // NFR/interface generation sometimes needs a little broader coverage.
    critic: 0.3, // Audits should be strict and repeatable.
    evaluator: 0.2, // Scoring tasks should be highly deterministic.
    logic: 0.0,
});

/**
 * The per-call shapes, tuned against a 20k-output reference model. These express the
 * *relative* size of each call (a requirements pass needs ~5x a small JSON pass); they are
 * the basis for the ratios below, not the numbers actually sent to a provider.
 */
const TUNED_BUDGETS = Object.freeze({
    smallJson: 2048,
    mediumJson: 4096,
    architectSection: 6144,
    srsShell: 8192,
    srsFeatures: 16384,
    srsRequirements: 20000,
    srsAppendices: 12000,
    srsRefinement: 18000,
});

/**
 * Extra room added to every budget for a reasoning model's private thinking.
 *
 * The budgets above were tuned when `maxOutputTokens` meant "room for the answer". On a
 * reasoning model it does not: thinking is billed against the same allowance and is spent
 * *before* the first visible character, so a budget sized only for the answer truncates
 * mid-JSON. That is overhead on top of the response, not a floor under it — which is why it
 * is added rather than maxed, and why it keeps the relative shape of the budgets intact.
 *
 * Measured on gemini-3.5-flash: 1,274–1,490 thinking tokens across prompts from a one-line
 * instruction to a twelve-feature SRS draft, so the cost is roughly fixed rather than
 * proportional to input. 4,096 leaves headroom for the variance and for longer documents.
 *
 * What this fixes: at the old 2,048 `smallJson`, the Layer-2 validation prompt spent 1,490
 * tokens thinking and needed 625 more for its JSON — finishing `MAX_TOKENS` with unparseable
 * output on *every* run. That failure pinned every draft in its pre-validation state, so the
 * user was returned to the brief they had just written and no amount of re-running advanced
 * it. The same starvation hit the Reviewer at `mediumJson` and failed the reflection loop.
 */
const THINKING_HEADROOM = 4096;

/** The output ceiling the constants above were sized for; the basis for the ratios below. */
const REFERENCE_CEILING = 20000;

/**
 * Static budgets. Used verbatim whenever the active model's real ceiling is unknown, so a
 * caller that supplies no model metadata still gets a budget a reasoning model can complete.
 */
export const OUTPUT_TOKEN_LIMITS = Object.freeze(
    Object.fromEntries(
        Object.entries(TUNED_BUDGETS).map(([key, value]) => [key, value + THINKING_HEADROOM])
    )
);

/**
 * Each budget as a share of the model's real output ceiling. Derived from the tuned numbers
 * rather than the headroom-inclusive ones, so the headroom is added once — scaling a value
 * that already contains it would inflate it in proportion to the model's size.
 */
const BUDGET_RATIOS = Object.freeze(
    Object.fromEntries(
        Object.entries(TUNED_BUDGETS).map(([key, value]) => [key, value / REFERENCE_CEILING])
    )
);

/** Below this, a "ceiling" is almost certainly bad metadata rather than a real limit. */
const MIN_CREDIBLE_CEILING = 1024;

/**
 * Size the per-section output budgets against the model actually being used.
 *
 * Fixed budgets fail in both directions. Against a model whose ceiling is 8192, asking for
 * 20000 either errors or silently truncates mid-array — the exact failure that reached the
 * JSON repair pipeline in production. Against a model that allows 65536, capping at 20000
 * causes avoidable truncation on long specs while the headroom goes unused.
 *
 * @param {number} [outputCeiling] - the model's real maxOutputTokens, from provider metadata
 * @returns {Readonly<Record<string, number>>} budgets clamped to that ceiling
 */
export function resolveOutputTokenLimits(outputCeiling) {
    const ceiling = Number(outputCeiling);
    if (!Number.isFinite(ceiling) || ceiling < MIN_CREDIBLE_CEILING) {
        return OUTPUT_TOKEN_LIMITS;
    }

    return Object.freeze(
        Object.fromEntries(
            Object.entries(BUDGET_RATIOS).map(([key, ratio]) => [
                key,
                // Scale the answer to the model, then add the thinking overhead — and never
                // exceed the ceiling, which the API rejects outright. On a model too small to
                // hold both, the ceiling wins and the call simply has less room to think in.
                Math.min(ceiling, Math.round(ratio * ceiling) + THINKING_HEADROOM)
            ])
        )
    );
}

/**
 * Clamp a single requested budget to what the model permits.
 * @param {number} requested - the budget the caller asked for
 * @param {number} [outputCeiling] - the model's real maxOutputTokens
 * @returns {number}
 */
export function clampOutputTokens(requested, outputCeiling) {
    const ceiling = Number(outputCeiling);
    if (!Number.isFinite(ceiling) || ceiling < MIN_CREDIBLE_CEILING) return requested;
    return Math.min(requested, ceiling);
}
