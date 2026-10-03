import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { patchMe } = vi.hoisted(() => ({ patchMe: vi.fn() }));

vi.mock("@/lib/api", () => ({
  api: { api: { me: { patch: (body: unknown) => patchMe(body) } } },
}));

import { useUpdateEmailRemindersMutation } from "../src/hooks/use-email-reminders";
import { useUpdatePixKeyMutation } from "../src/hooks/use-pix";

function setup() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const spy = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { spy, wrapper };
}

beforeEach(() => {
  patchMe.mockReset();
});

describe("Ajustes revalidam o Agora (o guia risca o passo sozinho)", () => {
  it("salvar a chave PIX revalida o home", async () => {
    patchMe.mockResolvedValue({
      data: { pixKey: "joao@example.com" },
      error: null,
    });
    const { spy, wrapper } = setup();
    const { result } = renderHook(() => useUpdatePixKeyMutation(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync("joao@example.com");
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["home"] });
  });

  it("ligar os lembretes revalida o home", async () => {
    patchMe.mockResolvedValue({
      data: { emailRemindersOptIn: true },
      error: null,
    });
    const { spy, wrapper } = setup();
    const { result } = renderHook(() => useUpdateEmailRemindersMutation(), {
      wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync(true);
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["home"] });
  });
});
