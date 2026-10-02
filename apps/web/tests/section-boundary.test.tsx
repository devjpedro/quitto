import { useSuspenseQuery } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
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
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Conectando ao servidor…"
    );
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
    expect(
      await screen.findByText("Não foi possível carregar esta parte.")
    ).toBeVisible();
    fail = false;
    await userEvent.click(
      screen.getByRole("button", { name: "Tentar de novo" })
    );
    expect(await screen.findByText("recuperado")).toBeVisible();
  });
});
