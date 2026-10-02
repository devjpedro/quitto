import { useSuspenseQuery } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SectionBoundary } from "@/components/ui/section-boundary";
import { renderWithProviders } from "./test-utils";

function Data({ load }: { load: () => Promise<string> }) {
  const { data } = useSuspenseQuery({ queryKey: ["section"], queryFn: load });
  return <p>{data}</p>;
}

describe("SectionBoundary", () => {
  it("shows the skeleton, then a calm 'connecting' notice when slow", async () => {
    renderWithProviders(
      <SectionBoundary fallback={<span>esqueleto</span>} slowAfterMs={20}>
        <Data load={() => new Promise(() => undefined)} />
      </SectionBoundary>
    );
    expect(screen.getByText("esqueleto")).toBeVisible();
    // The live region is mounted empty and filled later: a status that
    // appears already containing its text is not reliably announced.
    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();
    expect(status.closest("[aria-busy]")).toBeNull();
    await waitFor(() =>
      expect(status).toHaveTextContent("Conectando ao servidor…")
    );
    expect(screen.getByRole("status")).toBe(status);
  });

  it("renders the content when data arrives", async () => {
    renderWithProviders(
      <SectionBoundary fallback={<span>esqueleto</span>}>
        <Data load={async () => "pronto"} />
      </SectionBoundary>
    );
    expect(await screen.findByText("pronto")).toBeVisible();
  });

  it("shows an inline error and recovers on retry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    let fail = true;
    const load = vi.fn(() =>
      fail ? Promise.reject(new Error("boom")) : Promise.resolve("recuperado")
    );
    renderWithProviders(
      <SectionBoundary fallback={<span>esqueleto</span>}>
        <Data load={load} />
      </SectionBoundary>
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar esta parte."
    );
    fail = false;
    await userEvent.click(
      screen.getByRole("button", { name: "Tentar de novo" })
    );
    expect(await screen.findByText("recuperado")).toBeVisible();
  });
});
