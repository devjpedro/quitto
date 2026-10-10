import { describe, expect, it } from "vitest";
import {
  clearIdentityCookieString,
  IDENTITY_COOKIE,
  parseIdentityCookie,
  serializeIdentityCookie,
} from "@/lib/identity-cookie";
import type { SessionIdentity } from "@/lib/session-resolver";

const maria: SessionIdentity = {
  id: "u1",
  name: "Maria Souza; Ç",
  email: "maria@example.com",
  image: null,
};

/** The `name=value` pair of a `document.cookie` assignment, as a browser would send it back. */
function asHeader(assignment: string): string {
  return assignment.split(";")[0] ?? "";
}

function headerWith(json: unknown): string {
  return `${IDENTITY_COOKIE}=${encodeURIComponent(JSON.stringify(json))}`;
}

describe("serializeIdentityCookie", () => {
  it("round-trips through the Cookie header", () => {
    const cookie = serializeIdentityCookie(maria, { secure: false });
    expect(parseIdentityCookie(asHeader(cookie))).toEqual(maria);
  });

  it("round-trips an image URL", () => {
    const withImage = { ...maria, image: "https://cdn.example.com/a.png" };
    const cookie = serializeIdentityCookie(withImage, { secure: false });
    expect(parseIdentityCookie(asHeader(cookie))).toEqual(withImage);
  });

  it("writes a first-party, 30-day, Lax cookie on the whole site", () => {
    const cookie = serializeIdentityCookie(maria, { secure: false });
    expect(cookie.startsWith(`${IDENTITY_COOKIE}=`)).toBe(true);
    expect(cookie).toContain("; Path=/; Max-Age=2592000; SameSite=Lax");
    expect(cookie).not.toContain("Secure");
  });

  it("adds Secure only when requested", () => {
    const cookie = serializeIdentityCookie(maria, { secure: true });
    expect(cookie.endsWith("; Secure")).toBe(true);
  });

  it("keeps only the identity fields", () => {
    const user = { ...maria, pixKey: "secret-pix", locale: "pt-BR" };
    const cookie = serializeIdentityCookie(user, { secure: false });
    expect(decodeURIComponent(asHeader(cookie))).not.toContain("secret-pix");
  });
});

describe("clearIdentityCookieString", () => {
  it("expires the cookie on the same path", () => {
    expect(clearIdentityCookieString()).toBe(
      "quitto_identity=; Path=/; Max-Age=0; SameSite=Lax"
    );
  });
});

describe("parseIdentityCookie", () => {
  it("returns null without a Cookie header", () => {
    expect(parseIdentityCookie(null)).toBeNull();
    expect(parseIdentityCookie(undefined)).toBeNull();
    expect(parseIdentityCookie("")).toBeNull();
  });

  it("returns null when the identity cookie is missing", () => {
    expect(parseIdentityCookie("theme=dark; locale=pt-BR")).toBeNull();
  });

  it("finds the cookie among others", () => {
    const header = [
      "theme=dark",
      "better-auth.session_token=abc.def",
      asHeader(serializeIdentityCookie(maria, { secure: false })),
      "locale=pt-BR",
    ].join("; ");
    expect(parseIdentityCookie(header)).toEqual(maria);
  });

  it("does not match a cookie whose name only ends with the same name", () => {
    expect(
      parseIdentityCookie(`x_${headerWith(maria)}; theme=dark`)
    ).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(
      parseIdentityCookie(`${IDENTITY_COOKIE}=${encodeURIComponent("{oops")}`)
    ).toBeNull();
  });

  it("returns null for malformed URI encoding", () => {
    expect(parseIdentityCookie(`${IDENTITY_COOKIE}=%E0%A4%A`)).toBeNull();
  });

  it("returns null for a JSON value that is not an object", () => {
    expect(parseIdentityCookie(headerWith(null))).toBeNull();
    expect(parseIdentityCookie(headerWith("Maria"))).toBeNull();
    expect(parseIdentityCookie(headerWith([1, 2]))).toBeNull();
  });

  it("returns null for wrong field types", () => {
    expect(parseIdentityCookie(headerWith({ ...maria, id: 1 }))).toBeNull();
    expect(parseIdentityCookie(headerWith({ ...maria, name: "" }))).toBeNull();
    expect(
      parseIdentityCookie(headerWith({ ...maria, email: null }))
    ).toBeNull();
    expect(parseIdentityCookie(headerWith({ ...maria, image: 3 }))).toBeNull();
    const { image: _image, ...withoutImage } = maria;
    expect(parseIdentityCookie(headerWith(withoutImage))).toBeNull();
  });

  it("drops unknown fields", () => {
    expect(
      parseIdentityCookie(headerWith({ ...maria, role: "admin" }))
    ).toEqual(maria);
  });

  it("returns null for an oversized value", () => {
    const huge = { ...maria, name: "M".repeat(2100) };
    expect(parseIdentityCookie(headerWith(huge))).toBeNull();
  });
});
