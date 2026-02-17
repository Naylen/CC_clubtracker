/**
 * Format a membership number for display: zero-padded to at least 3 digits.
 * e.g., 1 → "001", 42 → "042", 1234 → "1234"
 *
 * This is a pure utility — safe to import from client components.
 */
export function formatMembershipNumber(num: number): string {
  return String(num).padStart(3, "0");
}
