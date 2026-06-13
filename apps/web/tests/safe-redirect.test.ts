import { describe, expect, it } from "vitest";
import { safeRedirect } from "../src/lib/safe-redirect";

const ORIGIN = "https://app.example.com";

describe("safeRedirect", () => {
  it("passes through same-origin relative paths", () => {
    expect(safeRedirect("/contracts/123", ORIGIN)).toBe("/contracts/123");
    expect(safeRedirect("/invites/tok1", ORIGIN)).toBe("/invites/tok1");
  });

  it("falls back to / for undefined", () => {
    expect(safeRedirect(undefined, ORIGIN)).toBe("/");
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeRedirect("//evil.com", ORIGIN)).toBe("/");
  });

  it("rejects backslash bypass (CVE-style case)", () => {
    expect(safeRedirect("/\\evil.com", ORIGIN)).toBe("/");
  });

  it("rejects absolute off-origin URLs", () => {
    expect(safeRedirect("https://evil.com/x", ORIGIN)).toBe("/");
  });

  it("rejects off-origin scheme-smuggling", () => {
    // Two leading separators after the scheme give an authority → OFF-origin,
    // so these escape to evil.com and must be blocked.
    expect(safeRedirect("https:\\\\evil.com", ORIGIN)).toBe("/");
    expect(safeRedirect("https://evil.com", ORIGIN)).toBe("/");
  });

  it("keeps single-separator scheme-relative forms on-origin (not an open redirect)", () => {
    // The WHATWG parser treats a single separator after the scheme as a
    // same-scheme relative ref, normalizing `\`→`/` and resolving to a
    // SAME-ORIGIN path. The browser would navigate to app.example.com/evil.com,
    // never to evil.com, so returning the relative path is safe.
    expect(safeRedirect("https:/evil.com", ORIGIN)).toBe("/evil.com");
    expect(safeRedirect("https:\\evil.com", ORIGIN)).toBe("/evil.com");
    expect(safeRedirect("https:evil.com", ORIGIN)).toBe("/evil.com");
  });

  it("resolves a same-origin absolute URL to a relative path, preserving query", () => {
    expect(safeRedirect("https://app.example.com/dashboard?x=1", ORIGIN)).toBe(
      "/dashboard?x=1"
    );
  });
});
