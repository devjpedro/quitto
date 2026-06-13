/** Lowercases and trims an email for case-insensitive comparison. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
