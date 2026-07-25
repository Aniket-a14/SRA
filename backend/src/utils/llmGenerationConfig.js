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
 * Static budgets, tuned against a 20k-output reference model. Used verbatim whenever the
 * active model's real ceiling is unknown, so behaviour is unchanged for any caller that
 * does not supply model metadata.
 */
export const OUTPUT_TOKEN_LIMITS = Object.freeze({
    smallJson: 2048,
    mediumJson: 4096,
    architectSection: 6144,
    srsShell: 8192,
    srsFeatures: 16384,
    srsRequirements: 20000,
    srsAppendices: 12000,
    srsRefinement: 18000,
});

/** The output ceiling the constants above were sized for; the basis for the ratios below. */
const REFERENCE_CEILING = 20000;

/**
 * Each budget as a share of the model's real output ceiling. Derived from the static
 * numbers so the relative shape (a requirements pass gets ~5x a small JSON pass) survives
 * regardless of which model is in use.
 */
const BUDGET_RATIOS = Object.freeze(
    Object.fromEntries(
        Object.entries(OUTPUT_TOKEN_LIMITS).map(([key, value]) => [key, value / REFERENCE_CEILING])
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
                // Never exceed the ceiling (the API rejects it), never drop below a floor
                // that would truncate even a trivial response.
                Math.max(512, Math.min(ceiling, Math.round(ratio * ceiling)))
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
