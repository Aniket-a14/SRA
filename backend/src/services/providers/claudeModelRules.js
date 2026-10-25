/**
 * Per-model request shaping for the Claude Messages API (API version 2026-10-21,
 * @anthropic-ai/sdk 1.x).
 *
 * ClaudeAdapter used to send `thinking: { type: 'disabled' }` and the pipeline's
 * `temperature` to every model, and current models reject both with a 400:
 *   - `temperature` / `top_p` / `top_k`: removed from the API on 2026-10-21 for every model
 *     (Claude 4.7 and later already rejected non-default values on 2023-06-01). Claude calls
 *     therefore never carry one; models 4.6 and older now sample at the default (1.0).
 *   - `thinking: disabled`: rejected on Opus 5.5 and on Fable/Mythos at every effort, and on
 *     Sonnet 5.5 (which turns thinking off with `between_tools` instead).
 * Users pick any model their key can list, so the shape has to follow the model.
 *
 * The intent of the old request was "no thinking, spend the whole budget on the JSON".
 * Each model gets the closest thing it accepts:
 *   - `disabled` where it is accepted and reliable;
 *   - `between_tools` on Sonnet 5.5 (its thinking-off mode; no tools are used here);
 *   - adaptive thinking at `low` effort where thinking cannot be turned off (Opus 5.5,
 *     Fable, Mythos) or where disabling it is documented as unreliable (Opus 5, which can
 *     leak thinking tags into visible text, which would corrupt a JSON reply).
 *
 * Unknown ids fail safe: no thinking parameter, so each model's own default applies, which
 * the API accepts by definition.
 */

/**
 * Parse a Claude model id into family and version.
 * Handles current ids (`claude-opus-5-5`, `claude-fable-5`), dated snapshots
 * (`claude-sonnet-4-5-20250929`) and the legacy order (`claude-3-7-sonnet-20250219`).
 *
 * @param {string} id
 * @returns {{ family: string, major: number, minor: number } | null}
 */
export function parseClaudeModel(id) {
    const s = String(id || '').toLowerCase().replace(/@.*$/, '');
    let m = s.match(/claude-(opus|sonnet|haiku|fable|mythos)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?(?:$|[^\d])/);
    if (m) return { family: m[1], major: Number(m[2]), minor: m[3] !== undefined ? Number(m[3]) : 0 };
    m = s.match(/claude-(\d+)(?:-(\d{1,2}))?-(opus|sonnet|haiku)/);
    if (m) return { family: m[3], major: Number(m[1]), minor: m[2] !== undefined ? Number(m[2]) : 0 };
    return null;
}

const atLeast = (p, major, minor) => p.major > major || (p.major === major && p.minor >= minor);

/**
 * Thinking / effort fields that keep thinking off, or as close to off as the model allows.
 * @returns {{ thinking?: object, output_config?: object }}
 */
export function thinkingOffFields(modelId) {
    const p = parseClaudeModel(modelId);
    if (!p) return {};
    const lowEffort = { output_config: { effort: 'low' } };
    if (p.family === 'fable' || p.family === 'mythos') return lowEffort;
    if (p.family === 'opus' && atLeast(p, 5, 0)) return lowEffort; // Opus 5 and 5.5
    if (p.family === 'sonnet' && atLeast(p, 5, 5)) return { thinking: { type: 'between_tools' } };
    return { thinking: { type: 'disabled' } };
}

/**
 * Request fields for one Messages call on `modelId`. Sampling parameters are deliberately
 * absent: the API rejects them on every model (see the header).
 * @param {string} modelId
 */
export function claudeRequestFields(modelId) {
    return thinkingOffFields(modelId);
}

/** A refusal is an empty reply with a reason; surface it instead of a JSON parse error. */
export function assertNotRefused(message, modelName) {
    if (message?.stop_reason !== 'refusal') return;
    const category = message?.stop_details?.category;
    const err = new Error(
        `Claude (${modelName}) declined this request${category ? ` (category: ${category})` : ''}. ` +
        'Try rephrasing the input or choose a different model.'
    );
    err.refusal = true;
    err.refusalCategory = category || null;
    throw err;
}
