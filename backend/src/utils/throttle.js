/**
 * Provider-aware cooldown between LLM calls.
 *
 * The sectional Developer generation and the reflection loop insert deliberate pauses to
 * stay under Gemini's FREE-tier requests-per-minute limit. Those pauses are pure wasted
 * latency for a paid BYOK provider (OpenAI / Claude / Grok) or a paid Gemini tier — a run
 * that used to idle ~15–20s in sleeps now runs at full speed. We therefore only actually
 * sleep when the run is on free-tier Gemini.
 *
 *  - Non-Gemini provider  -> never sleeps (user's own paid quota).
 *  - GEMINI_TIER=paid     -> never sleeps (paid Gemini quota).
 *  - MOCK_AI=true         -> never sleeps (tests / offline).
 *  - free-tier Gemini     -> sleeps the requested ms.
 *
 * @param {string} provider - resolved provider (GEMINI | OPENAI | CLAUDE | GROK)
 * @returns {(ms: number) => Promise<void>} a cooldown function
 */
export function createCooldown(provider) {
    const isGemini = String(provider || 'GEMINI').toUpperCase() === 'GEMINI';
    const geminiPaid = process.env.GEMINI_TIER === 'paid';
    const shouldThrottle = isGemini && !geminiPaid && process.env.MOCK_AI !== 'true';

    return (ms) => {
        if (!shouldThrottle || !ms) return Promise.resolve();
        return new Promise((resolve) => setTimeout(resolve, ms));
    };
}
