import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async () => ({
  Link: (await import("./router-link-stub")).LinkStub,
  useHydrated: () => true,
  useSearch: () => ({}),
}));
vi.mock("@/lib/auth-client", () => ({
  signIn: { email: vi.fn(), social: vi.fn() },
  signUp: { email: vi.fn() },
  sendVerificationEmail: vi.fn(),
}));

import { LoginPage } from "../src/features/auth/components/login-page";
import {
  IDENTITY_COOKIE,
  serializeIdentityCookie,
} from "../src/lib/identity-cookie";
import { renderWithProviders } from "./test-utils";

afterEach(() => {
  // biome-ignore lint/suspicious/noDocumentCookie: test cleanup of the first-party identity cookie
  document.cookie = `${IDENTITY_COOKIE}=; Path=/; Max-Age=0`;
});

describe("login page", () => {
  it("drops the previous user's identity cookie, so the next sign-in never shows their name", () => {
    // biome-ignore lint/suspicious/noDocumentCookie: seeding the cookie left behind by a previous user
    document.cookie = serializeIdentityCookie(
      { id: "u-a", name: "Pessoa A", email: "a@example.com", image: null },
      { secure: false }
    );
    expect(document.cookie).toContain(IDENTITY_COOKIE);

    renderWithProviders(<LoginPage />);

    expect(document.cookie).not.toContain(IDENTITY_COOKIE);
  });
});
