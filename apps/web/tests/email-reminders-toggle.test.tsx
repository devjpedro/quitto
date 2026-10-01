import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test-utils";

const mutate = vi.fn();
vi.mock("../src/hooks/use-email-reminders", () => ({
  useUpdateEmailRemindersMutation: () => ({ mutate, isPending: false }),
}));

import { EmailRemindersToggle } from "../src/components/email-reminders-toggle";

const SWITCH = /receber lembretes de parcelas por e-mail/i;
const DESCRIPTION = /um e-mail por dia/i;

describe("EmailRemindersToggle", () => {
  beforeEach(() => mutate.mockReset());

  it("reflete o estado e liga ao clicar", async () => {
    renderWithProviders(<EmailRemindersToggle checked={false} />);
    const sw = screen.getByRole("switch", { name: SWITCH });
    expect(sw).toHaveAttribute("aria-checked", "false");
    await userEvent.click(sw);
    expect(mutate).toHaveBeenCalledWith(true);
  });

  it("desliga quando já está ligado", async () => {
    renderWithProviders(<EmailRemindersToggle checked />);
    const sw = screen.getByRole("switch", { name: SWITCH });
    expect(sw).toHaveAttribute("aria-checked", "true");
    await userEvent.click(sw);
    expect(mutate).toHaveBeenCalledWith(false);
  });

  it("descreve o switch via aria-describedby", () => {
    renderWithProviders(<EmailRemindersToggle checked={false} />);
    expect(
      screen.getByRole("switch", { name: SWITCH })
    ).toHaveAccessibleDescription(DESCRIPTION);
  });
});
