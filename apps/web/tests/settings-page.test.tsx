import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/delete-account-dialog", () => ({
  DeleteAccountDialog: () => <div data-testid="delete-dialog" />,
}));
vi.mock("@/components/pix-key-form", () => ({
  PixKeyForm: () => <div data-testid="pix-key-form" />,
}));
vi.mock("@/hooks/use-me", () => ({
  useMeQuery: () => ({
    data: { id: "u1", name: "Maria", email: "maria@example.com" },
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
});
