import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/delete-account-dialog", () => ({
  DeleteAccountDialog: () => <div data-testid="delete-dialog" />,
}));
vi.mock("@/components/pix-key-form", () => ({
  PixKeyForm: () => <div data-testid="pix-key-form" />,
}));
const meData = vi.hoisted(() => ({
  value: {
    id: "u1",
    name: "Maria",
    email: "maria@example.com",
    emailRemindersAvailable: false,
    emailRemindersOptIn: false,
  },
}));
vi.mock("@/hooks/use-me", () => ({
  useMeQuery: () => ({ data: meData.value }),
}));
vi.mock("@/hooks/use-email-reminders", () => ({
  useUpdateEmailRemindersMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

import { SettingsPage } from "../src/features/settings/settings-page";

const EXPORT = /exportar/i;

describe("SettingsPage", () => {
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
