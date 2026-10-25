/**
 * The one mermaid configuration every render path starts from.
 *
 * - `securityLevel: "strict"`: diagram source is LLM output that user input can steer. The two
 *   export paths used `"loose"`, which allows HTML in labels and click callbacks into the page,
 *   and because `mermaid.initialize()` is global, running an export also left the on-screen
 *   renderer on `"loose"` until it remounted. The on-screen renderer has always used `"strict"`
 *   and renders these diagrams fine, so nothing needs `"loose"`.
 * - `layout: "dagre"` and `look: "classic"`: mermaid 12 switched the default layout to ELK and
 *   the default look to `neo`, which re-lays out and recolours every existing flowchart, state,
 *   class and ER diagram. These keep generated SRS diagrams looking as they did.
 *
 * Callers add their own `theme` (and any theme variables) on top.
 */
export const MERMAID_BASE_CONFIG = {
    startOnLoad: false,
    securityLevel: "strict",
    layout: "dagre",
    look: "classic",
} as const
