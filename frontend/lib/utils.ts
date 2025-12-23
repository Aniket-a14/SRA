import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getAcronym = (title: string): string => {
  return title
    .replace(/[^a-zA-Z\s]/g, "")
    .split(/\s+/)
    .map(w => w[0])
    .join("")
    .toUpperCase() || "SRA";

};

export function cleanInputText(text: string): string {
  if (!text) return ""

  // Try parsing as JSON first (for srsData structures)
  try {
    if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
      const parsed = JSON.parse(text);
      // Case 1: SRS Draft Data style { introduction: { purpose: { content: "..." } } }
      if (typeof parsed === 'object' && parsed !== null) {
        // Heuristic: breadth-first search for first "content" string or "purpose" string
        // Or specific known paths
        if (parsed.introduction?.purpose?.content) return parsed.introduction.purpose.content;
        if (parsed.srsData?.introduction?.purpose?.content) return parsed.srsData.introduction.purpose.content;

        // General fallback: return values of first level keys joined? 
        // Better: Just check if it's the specific structure we know.
      }
    }
  } catch {
    // Not valid JSON, proceed to regex cleanup
  }

  return text
    // 1. Remove the entire Previous SRS Context block (JSON state)
    .replace(/\[PREVIOUS_SRS_CONTEXT_START\][\s\S]*?\[PREVIOUS_SRS_CONTEXT_END\]/g, "")
    // 2. Remove full marker tags for Original Request and Improvement Instruction
    .replace(/\[(ORIGINAL_REQUEST|IMPROVEMENT_INSTRUCTION)_(START|END)\]/g, "")
    // 3. Remove partial tags at the end (often from truncation in previews)
    .replace(/\s*\[[A-Z_]+(?:\.\.\.)?$/g, "")
    // 4. Remove partial tags at the start (less common but possible)
    .replace(/^\[[A-Z_]+(?:\.\.\.)?\s*/g, "")
    .trim()
}
