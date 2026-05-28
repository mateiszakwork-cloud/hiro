import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a skill name for display: title-case lowercased skills while
 * preserving acronyms, product names, and branded terms that already
 * have proper casing.
 */
export function formatSkillName(skill: string): string {
  const words = skill.split(" ");
  const smallWords = new Set([
    "a", "an", "the", "and", "but", "or", "nor", "for", "yet", "so",
    "at", "by", "from", "in", "into", "of", "off", "on", "onto", "out",
    "over", "to", "up", "with", "as",
  ]);

  return words
    .map((word, idx) => {
      if (!word) return word;
      // Keep all-caps acronyms (e.g. CRM, SEO, SAP)
      if (/^[A-Z]{2,}$/.test(word)) return word;
      // Preserve mixed-case branded terms (e.g. iOS, JavaScript, PowerBI)
      if (/[a-z][A-Z]/.test(word)) return word;
      // Preserve words that already have capitals beyond the first letter
      if (word.length > 1 && word.slice(1).match(/[A-Z]/)) return word;
      // Lowercase small words unless they are the first word
      const lower = word.toLowerCase();
      if (idx > 0 && smallWords.has(lower)) return lower;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}
