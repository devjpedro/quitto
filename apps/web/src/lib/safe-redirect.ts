/**
 * Resolves a user-supplied `redirect` search param to a SAME-ORIGIN relative
 * path, defending against open-redirect phishing (protocol-relative `//host`,
 * backslash `/\host`, scheme-smuggling `https:/...`, etc.). Anything that
 * resolves off-origin — or fails to parse — falls back to "/".
 */
export function safeRedirect(raw: string | undefined, origin: string): string {
  if (!raw) {
    return "/";
  }
  try {
    const url = new URL(raw, origin);
    if (url.origin === origin) {
      return url.pathname + url.search + url.hash;
    }
  } catch {
    // unparseable — fall through to the safe default
  }
  return "/";
}
