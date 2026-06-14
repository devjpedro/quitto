import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/delete-account-dialog", () => ({
  DeleteAccountDialog: () => <div data-testid="delete-dialog" />,
}));

import { SettingsPage } from "../src/routes/settings";

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
});
