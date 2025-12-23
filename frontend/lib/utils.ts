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
