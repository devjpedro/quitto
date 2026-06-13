import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../src/components/ui/dropdown-menu";
import { renderWithProviders } from "./test-utils";

const RE_ACOES = /ações/i;
const RE_REMOVER = /remover/i;

describe("DropdownMenu", () => {
  it("abre via clique no gatilho e dispara o item", async () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Ações">⋯</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onSelect}>Remover</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    await userEvent.click(screen.getByRole("button", { name: RE_ACOES }));
    await waitFor(() =>
      expect(
        screen.getByRole("menuitem", { name: RE_REMOVER })
      ).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("menuitem", { name: RE_REMOVER }));
    expect(onSelect).toHaveBeenCalled();
  });
});
