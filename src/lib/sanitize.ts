// ─── Input Sanitization Utilities ─────────────────────────────────────────────
// Prevents XSS, SQL injection fragments, and other malicious input from reaching
// the database or being rendered in the UI.

/**
 * Strip HTML tags from a string. Use for any user-provided text fields
 * before displaying them (defense-in-depth alongside React's auto-escaping).
 */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

/**
 * Sanitize a free-text input field. Removes HTML tags, trims whitespace,
 * and limits length to prevent abuse.
 */
export function sanitizeText(input: string, maxLength = 500): string {
  return stripHtml(input).slice(0, maxLength);
}

/**
 * Sanitize a phone/mobile number. Only allows digits, spaces, hyphens,
 * parentheses, and the + prefix.
 */
export function sanitizePhone(input: string): string {
  return input.replace(/[^\d\s\-+()]/g, "").trim().slice(0, 20);
}

/**
 * Sanitize an email address. Lowercase, trim, and validate format.
 * Returns empty string if invalid.
 */
export function sanitizeEmail(input: string): string {
  const cleaned = input.toLowerCase().trim().slice(0, 254);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(cleaned) ? cleaned : "";
}

/**
 * Sanitize a monetary amount. Ensures it's a valid positive number
 * with at most 2 decimal places.
 */
export function sanitizeAmount(input: string | number): number {
  const num = typeof input === "string" ? parseFloat(input) : input;
  if (isNaN(num) || num < 0) return 0;
  return Math.round(num * 100) / 100; // Round to 2 decimal places
}

/**
 * Sanitize a generic identifier (SKU, code, etc). Only allows
 * alphanumeric characters, hyphens, and underscores.
 */
export function sanitizeIdentifier(input: string, maxLength = 50): string {
  return input.replace(/[^a-zA-Z0-9\-_]/g, "").trim().slice(0, maxLength);
}
