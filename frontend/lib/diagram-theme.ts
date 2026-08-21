/**
 * Shared React Flow edge/grid styling for the DFD and knowledge-graph canvases
 * (DFDViewer.tsx, knowledge-graph-tab.tsx). Both independently hardcoded the same slate
 * palette — centralized here so the two diagrams can't silently drift apart. React Flow
 * styles edges/markers via inline SVG attributes, which don't resolve CSS custom
 * properties reliably across export (toPng) — so these stay literal hex rather than
 * `var(--token)`, unlike the rest of the app's semantic-token styling.
 */
export const DIAGRAM_EDGE_THEME = {
    arrowColor: '#334155',       // slate-700 — arrowhead marker
    edgeStroke: '#64748b',       // slate-500 — default edge line
    edgeStrokeLight: '#cbd5e1',  // slate-300 — lighter edge line (knowledge graph)
    labelText: '#0f172a',        // slate-900 — edge label text
    labelBackground: '#f8fafc',  // slate-50 — edge label background
    gridDot: '#cbd5e1',          // slate-300 — canvas background grid dots
    canvasExportBackground: '#ffffff', // flattened export background (toPng)
} as const;
