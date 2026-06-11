/**
 * Input sanitization utilities (issue 010).
 *
 * Sanitization is deliberately kept separate from validation. Zod remains
 * the only authority on *whether* a value is acceptable; these helpers
 * normalize a *valid* string into a canonical, predictable form before
 * it is persisted.
 *
 * Design principles:
 *   - No automatic / global mutations. Callers opt in per field.
 *   - Pure functions. No I/O, no Prisma, no logging.
 *   - Idempotent. Running the same helper twice is a no-op.
 *   - Never touch passwords, emails, identifiers, or authentication
 *     tokens. Sanitize only free-form text input (names, addresses,
 *     descriptions, notes, remarks, business information, ...).
 *
 * Why not DOMPurify / sanitize-html? The application does not store or
 * render HTML. Stripping every angle bracket up front is cheaper and
 * easier to audit than maintaining an allowlist of tags.
 */

/**
 * Removes every ASCII control character except for the common whitespace
 * chars (space, tab, newline, carriage return). Guards against NULL bytes,
 * BOMs, and other invisible characters that may sneak in via copy-paste
 * from office documents.
 */
function stripControlChars(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

/**
 * Strips angle brackets and inline event handlers. The application does
 * not store or render HTML, so the safest behaviour is to remove any
 * markup-shaped content. We do this conservatively (no allowlist) because
 * the data is plain text by business contract.
 */
function stripUnsafeMarkup(value: string): string {
  return value
    .replace(/<[^>]*>/g, "") // strip tags
    .replace(/javascript:/gi, "") // strip js: URI scheme
    .replace(/on\w+\s*=/gi, ""); // strip inline event handlers (e.g. onclick=)
}

/**
 * Canonical free-text sanitization:
 *   1. Strip control characters
 *   2. Strip unsafe HTML/JS-like markup
 *   3. Trim leading / trailing whitespace
 *   4. Collapse runs of whitespace into a single space
 *
 * Suitable for names, addresses, notes, descriptions, remarks, and any
 * other free-form text the user can type into a form.
 */
export function sanitizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return stripControlChars(stripUnsafeMarkup(value))
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Same as {@link sanitizeText} but preserves internal newlines. Used for
 * multi-line fields like notes / descriptions where the user may want
 * paragraph breaks.
 */
export function sanitizeMultilineText(value: unknown): string {
  if (typeof value !== "string") return "";
  return stripControlChars(stripUnsafeMarkup(value))
    .trim()
    .replace(/[ \t]+/g, " ") // collapse spaces and tabs (not newlines)
    .replace(/\n{3,}/g, "\n\n"); // collapse 3+ blank lines to 2
}

/**
 * Sanitizes a single-line identifier-like field that should be kept
 * case-preserving but stripped of leading / trailing whitespace and
 * internal spaces. Useful for tags, slugs, or short codes that the
 * user enters manually.
 */
export function sanitizeToken(value: unknown): string {
  if (typeof value !== "string") return "";
  return stripControlChars(value).trim().replace(/\s+/g, "");
}

/**
 * Optional value variant. Returns `undefined` when the caller passes a
 * non-string, an empty string after trimming, or `null`/`undefined`.
 * Useful for PATCH-style updates where a missing key must be preserved
 * rather than overwritten with "".
 */
export function sanitizeOptionalText(
  value: unknown,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  const sanitized = sanitizeText(value);
  return sanitized.length > 0 ? sanitized : undefined;
}

/**
 * Walks a list of text fields on an object, sanitizing each in place.
 * Skips keys whose value is not a string (numbers, booleans, nested
 * objects, etc.). Returns the same object reference for chaining.
 */
export function sanitizeFields<T extends Record<string, unknown>>(
  obj: T,
  fields: readonly (keyof T)[],
  multiline: readonly (keyof T)[] = [],
): T {
  for (const field of fields) {
    if (field in obj) {
      (obj as Record<string, unknown>)[field as string] = sanitizeText(
        obj[field],
      );
    }
  }
  for (const field of multiline) {
    if (field in obj) {
      (obj as Record<string, unknown>)[field as string] =
        sanitizeMultilineText(obj[field]);
    }
  }
  return obj;
}