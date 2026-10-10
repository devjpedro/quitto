import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ patchMe: vi.fn(), toast: vi.fn() }));
vi.mock("@tanstack/react-router", async () => ({
  Link: (await import("./router-link-stub")).LinkStub,
  useHydrated: () => true,
}));
vi.mock("@/lib/api", () => ({
  api: { api: { me: { patch: mocks.patchMe } } },
}));
vi.mock("@/lib/auth-client", () => ({
  changePassword: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toast, error: vi.fn() },
}));

import { queryKeys } from "@/lib/query-keys";
import type { SessionUser } from "@/lib/session-resolver";
import { renderSettings } from "./settings-fixtures";

afterEach(() => vi.clearAllMocks());

describe("Lembretes", () => {
  it("ligar: otimista, PATCH com true e o toast de ligados", async () => {
    mocks.patchMe.mockResolvedValue({
      data: { emailRemindersOptIn: true },
      error: null,
    });
    const user = userEvent.setup();
    const { client } = renderSettings("reminders");
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await user.click(screen.getByRole("switch"));
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    await waitFor(() =>
      expect(mocks.patchMe).toHaveBeenCalledWith({ emailRemindersOptIn: true })
    );
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith("Lembretes por e-mail ligados")
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["home"] });
  });

  it("o lembrete volta atrás quando a API falha", async () => {
    mocks.patchMe.mockResolvedValue({
      data: null,
      error: { status: 500, value: {} },
    });
    const user = userEvent.setup();
    const { client } = renderSettings("reminders");
    await user.click(screen.getByRole("switch"));
    await waitFor(() =>
      expect(
        client.getQueryData<SessionUser>(queryKeys.me)?.emailRemindersOptIn
      ).toBe(false)
    );
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("o interruptor tem o nome e a dica (aria-describedby)", () => {
    renderSettings("reminders");
    const toggle = screen.getByRole("switch", { name: "Lembretes por e-mail" });
    expect(toggle).toHaveAccessibleDescription(
      "Um e-mail por dia quando uma parcela vence em 3 dias ou atrasa."
    );
  });
});
