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
  // Try parsing as JSON first (for srsData structures)
  try {
    if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
      const parsed = JSON.parse(text);
      if (typeof parsed === 'object' && parsed !== null) {
        // recursive extractor for "content" keys or flat strings
        const extractStrings = (obj: any): string[] => {
          if (typeof obj === 'string') return [obj];
          if (Array.isArray(obj)) return obj.flatMap(extractStrings);
          if (typeof obj === 'object' && obj !== null) {
            // Priority: 'content' key (common in our DraftIntake model)
            if ('content' in obj && typeof obj.content === 'string') return [obj.content];
            // Otherwise values
            return Object.values(obj).flatMap(extractStrings);
          }
          return [];
        };

        const extracted = extractStrings(parsed);
        if (extracted.length > 0) return extracted.join(" ").slice(0, 300); // Limit length
      }
    }
  } catch {
    // Not valid JSON, proceed to regex cleanup
  }

  // Fallback: If it looks like a string array but failed parse (e.g. ['A', 'B'] with single quotes or truncated)
  if (text.trim().startsWith('[') && text.includes(',')) {
    // Regex to match "Strings" or 'Strings'
    const matches = text.match(/(["'])(?:(?=(\\?))\2.)*?\1/g);
    if (matches && matches.length > 0) {
      // Remove quotes and join
      return matches.map(m => m.slice(1, -1)).join(' ');
    }
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

/**
 * Creates a throttled function that only invokes func at most once per
 * every wait milliseconds.
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  let previous = 0;
  return function (this: unknown, ...args: Parameters<T>) {
    const now = Date.now();
    const remaining = wait - (now - previous);

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      func.apply(this, args);
    } else if (!timeout) {
      timeout = setTimeout(() => {
        previous = Date.now();
        timeout = null;
        func.apply(this, args);
      }, remaining);
    }
  };
}

/**
 * Creates a debounced function that delays invoking func until after wait
 * milliseconds have elapsed since the last time the debounced function was
 * invoked.
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return function (this: unknown, ...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}
