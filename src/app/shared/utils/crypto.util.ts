/** Thin wrapper around the Web Crypto API for generating UUIDs */
export const crypto = {
  uuid(): string {
    return globalThis.crypto.randomUUID();
  },
};

/**
 * Converts a human-readable name into a URL-safe slug for use as an ID.
 *
 * Rules:
 *   - Lowercase
 *   - Spaces and underscores → hyphens
 *   - Any character that is not a letter, digit, or hyphen is removed
 *   - Consecutive hyphens collapsed to one
 *   - Leading/trailing hyphens trimmed
 *
 * If the result is empty (e.g. name was all special chars), falls back to a UUID.
 *
 * @example
 *   slugify('Food & Dining')   // 'food-dining'
 *   slugify('Health / Médical') // 'health-mdical'
 *   slugify('  My  Category ') // 'my-category'
 */
export function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')          // spaces & underscores → hyphens
    .replace(/[^a-z0-9-]/g, '')       // remove anything else
    .replace(/-+/g, '-')              // collapse consecutive hyphens
    .replace(/^-+|-+$/g, '');         // strip leading/trailing hyphens

  return slug || globalThis.crypto.randomUUID();
}
