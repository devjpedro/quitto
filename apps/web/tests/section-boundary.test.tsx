import { QueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SectionBoundary } from "@/components/ui/section-boundary";
import { TimeoutError } from "@/lib/with-timeout";
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

  it("recovers on retry by resetting the cached error, then focuses the section", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    let fail = true;
    const load = vi.fn(() =>
      fail ? Promise.reject(new Error("boom")) : Promise.resolve("recuperado")
    );
    // gcTime keeps the failed query cached: without the reset wiring the
    // boundary would rethrow the cached error instead of fetching again.
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 60_000 } },
    });
    renderWithProviders(
      <SectionBoundary fallback={<span>esqueleto</span>}>
        <Data load={load} />
      </SectionBoundary>,
      { client }
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar esta parte."
    );
    // Fill, not outline (mockup 13): the error box is a card on the panel.
    expect(screen.getByRole("alert")).toHaveClass("bg-surface-card");
    expect(screen.getByRole("alert")).not.toHaveClass("border");
    fail = false;
    await userEvent.click(
      screen.getByRole("button", { name: "Tentar de novo" })
    );
    const content = await screen.findByText("recuperado");
    expect(load).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toContainElement(content);
    // jsdom hands the focus to <body> when the clicked button unmounts, and
    // the body contains everything: check the section region itself took it.
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toHaveAttribute("tabindex", "-1");
  });

  it("says the server took too long when the request timed out", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderWithProviders(
      <SectionBoundary fallback={<span>esqueleto</span>}>
        <Data load={() => Promise.reject(new TimeoutError())} />
      </SectionBoundary>
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O servidor demorou para responder."
    );
    expect(
      screen.getByRole("button", { name: "Tentar de novo" })
    ).toBeVisible();
  });
});
