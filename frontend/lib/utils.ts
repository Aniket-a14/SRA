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
