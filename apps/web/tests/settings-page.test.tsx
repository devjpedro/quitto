import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/delete-account-dialog", () => ({
  DeleteAccountDialog: () => <div data-testid="delete-dialog" />,
}));
// Stub by default; the "real" flag swaps in the actual form for the test that
// needs its input to initialise from /me.
const pixForm = vi.hoisted(() => ({ real: false }));
vi.mock("@/components/pix-key-form", async (importActual) => {
  const actual =
    await importActual<typeof import("@/components/pix-key-form")>();
  return {
    PixKeyForm: () =>
      pixForm.real ? <actual.PixKeyForm /> : <div data-testid="pix-key-form" />,
  };
});
vi.mock("@/hooks/use-pix", () => ({
  useUpdatePixKeyMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
const meData = vi.hoisted(() => ({
  pending: false,
  value: {
    id: "u1",
    name: "Maria",
    email: "maria@example.com",
    emailRemindersAvailable: false,
    emailRemindersOptIn: false,
    pixKey: null as string | null,
  },
}));
vi.mock("@/hooks/use-me", () => ({
  useMeQuery: () =>
    meData.pending
      ? { data: undefined, isPending: true }
      : { data: meData.value, isPending: false },
}));
vi.mock("@/hooks/use-email-reminders", () => ({
  useUpdateEmailRemindersMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

import { SettingsPage } from "../src/features/settings/settings-page";

const EXPORT = /exportar/i;
const PIX_KEY_LABEL = /chave pix/i;

describe("SettingsPage", () => {
  afterEach(() => {
    meData.pending = false;
    meData.value.pixKey = null;
    pixForm.real = false;
  });

  it("shows export link and the delete section", () => {
    render(<SettingsPage />);
    expect(screen.getByRole("link", { name: EXPORT })).toHaveAttribute(
      "href",
      "/api/me/export"
    );
    expect(screen.getByTestId("delete-dialog")).toBeInTheDocument();
  });

  it("shows the profile name and email from useMeQuery", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Maria")).toBeInTheDocument();
    expect(screen.getByText("maria@example.com")).toBeInTheDocument();
  });

  it("renders the PixKeyForm", () => {
    render(<SettingsPage />);
    expect(screen.getByTestId("pix-key-form")).toBeInTheDocument();
  });

  it("holds the PIX form back until /me arrives, then shows the saved key", () => {
    pixForm.real = true;
    meData.pending = true;
    const { rerender } = render(<SettingsPage />);
    expect(screen.queryByLabelText(PIX_KEY_LABEL)).not.toBeInTheDocument();
    expect(screen.queryByTestId("pix-key-form")).not.toBeInTheDocument();

    meData.pending = false;
    meData.value.pixKey = "joao@example.com";
    rerender(<SettingsPage />);
    expect(screen.getByLabelText(PIX_KEY_LABEL)).toHaveValue(
      "joao@example.com"
    );
  });

  it("hides the email reminders section when the global switch is off", () => {
    meData.value.emailRemindersAvailable = false;
    render(<SettingsPage />);
    expect(
      screen.queryByRole("heading", { name: "Lembretes por e-mail" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("shows the email reminders section when the global switch is on", () => {
    meData.value.emailRemindersAvailable = true;
    render(<SettingsPage />);
    expect(
      screen.getByRole("heading", { name: "Lembretes por e-mail" })
    ).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    meData.value.emailRemindersAvailable = false;
  });
});
