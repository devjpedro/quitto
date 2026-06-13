import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CopyButton } from "../src/components/copy-button";
import { renderWithProviders } from "./test-utils";

const COPY = /copiar/i;
const COPIED = /copiado/i;

describe("CopyButton", () => {
  it("copia o valor e mostra feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    renderWithProviders(<CopyButton value="https://x/invites/abc" />);
    fireEvent.click(screen.getByRole("button", { name: COPY }));

    expect(writeText).toHaveBeenCalledWith("https://x/invites/abc");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: COPIED })).toBeInTheDocument()
    );
  });
});
