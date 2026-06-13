import { treaty } from "@elysiajs/eden";
import { describe, expect, it } from "vitest";

// Regression guard for the Fase-4b bug: Eden's treaty client revives any
// "YYYY-MM-DD"-ish string into a Date object by default (and drifts the day via
// UTC parsing). Our API speaks ISO date strings (installment.dueDate, etc.), and
// lib/api.ts disables that with `parseDate: false`. If someone removes that flag
// or an Eden upgrade changes the default, the contract-detail page crashes
// (formatISODateBR does iso.split). This locks the expected behavior.

const dateResponseFetcher = (() =>
  Promise.resolve(
    Response.json({ dueDate: "2026-07-10" })
  )) as unknown as typeof fetch;

interface DateProbeClient {
  api: { x: { get: () => Promise<{ data: { dueDate: unknown } }> } };
}

describe("Eden date handling", () => {
  it("keeps a YYYY-MM-DD string as a string when parseDate is false", async () => {
    const client = treaty<never>("http://localhost", {
      parseDate: false,
      fetcher: dateResponseFetcher,
    }) as unknown as DateProbeClient;
    const { data } = await client.api.x.get();
    expect(typeof data.dueDate).toBe("string");
    expect(data.dueDate).toBe("2026-07-10");
  });

  it("documents the default footgun: the same string is revived into a Date", async () => {
    const client = treaty<never>("http://localhost", {
      fetcher: dateResponseFetcher,
    }) as unknown as DateProbeClient;
    const { data } = await client.api.x.get();
    expect(data.dueDate).toBeInstanceOf(Date);
  });
});
