/**
 * The exact normalization algorithm used by both the organizer and student
 * sides. Changing it invalidates every stored name hash, so treat it as a
 * stable format.
 */
export function normalizeName(input: string): string {
  return input
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .sort()
    .join(" ");
}

/**
 * Identifiers (roll numbers and similar) keep digits, but lose spaces and
 * punctuation so "CS 21-B001" and "cs21b001" are the same value.
 */
export function normalizeIdentifier(input: string): string {
  return input
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]/gu, "");
}

export type NormalizedLabel = {
  /** Used for matching. Case and extra spaces are ignored. */
  key: string;
  /** Trimmed and space-collapsed, with the original capitalization. */
  display: string;
};

/**
 * Category labels and position text are matched without case or extra-space
 * sensitivity, while the readable form is kept for display.
 */
export function normalizeLabel(input: string): NormalizedLabel {
  const display = input.normalize("NFC").trim().replace(/\s+/g, " ");

  return { key: display.toLowerCase(), display };
}
