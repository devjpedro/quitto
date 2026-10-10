import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resend: vi.fn(),
  search: { error: "TOKEN_EXPIRED", redirect: "/invites/tok" } as {
    error?: string;
    redirect?: string;
  },
}));
vi.mock("@/lib/auth-client", () => ({
  sendVerificationEmail: mocks.resend,
}));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: (await import("./router-link-stub")).LinkStub,
  useSearch: () => mocks.search,
}));

import { VerifyEmailPage } from "../src/features/auth/components/verify-email-page";
import { Route } from "../src/routes/verify-email";
import { renderWithProviders as render } from "./test-utils";

afterEach(() => {
  mocks.search = { error: "TOKEN_EXPIRED", redirect: "/invites/tok" };
  vi.clearAllMocks();
});

function redirectTarget(search: { error?: string; redirect?: string }) {
  const beforeLoad = Route.options.beforeLoad as (ctx: {
    search: typeof search;
  }) => void;
  try {
    beforeLoad({ search });
  } catch (thrown) {
    return (thrown as { options?: { href?: string } }).options?.href ?? null;
  }
  return null;
}

describe("confirmar o e-mail", () => {
  it("TOKEN_EXPIRED: o título de vencido", () => {
    render(<VerifyEmailPage />);
    expect(
      screen.getByRole("heading", { name: "O link de confirmação venceu" })
    ).toBeVisible();
  });

  it("INVALID_TOKEN: o título de inválido", () => {
    mocks.search = { error: "INVALID_TOKEN" };
    render(<VerifyEmailPage />);
    expect(
      screen.getByRole("heading", {
        name: "Este link de confirmação não vale",
      })
    ).toBeVisible();
  });

  it("mandar outro link: sendVerificationEmail com o callbackURL de volta ao alvo", async () => {
    mocks.resend.mockResolvedValue({ data: {}, error: null });
    render(<VerifyEmailPage />);
    await userEvent.type(screen.getByLabelText("E-mail"), "a@b.com");
    await userEvent.click(
      screen.getByRole("button", { name: "Mandar outro link" })
    );
    expect(mocks.resend).toHaveBeenCalledWith({
      email: "a@b.com",
      callbackURL: "/verify-email?redirect=%2Finvites%2Ftok",
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Se a@b.com tiver conta para confirmar"
    );
  });

  it("sem error, o beforeLoad leva ao alvo", () => {
    expect(redirectTarget({ redirect: "/invites/tok" })).toBe("/invites/tok");
    expect(redirectTarget({ redirect: "https://evil.example/x" })).toBe("/");
    expect(redirectTarget({})).toBe("/");
    expect(redirectTarget({ error: "TOKEN_EXPIRED" })).toBeNull();
  });
});
