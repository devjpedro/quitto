import { afterEach, describe, expect, it, vi } from "vitest";
import { withRequestTimeout } from "@/lib/request-timeout";
import { TimeoutError } from "@/lib/with-timeout";

afterEach(() => {
  vi.useRealTimers();
});

/** A fetch that never answers but rejects like the real one once aborted. */
function hangingFetch() {
  return vi.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError"))
        );
      })
  );
}

describe("withRequestTimeout", () => {
  it("passes the response through when the API answers in time", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ ok: true }));
    const res = await withRequestTimeout(fetchImpl, 1000)("http://api.test/x");
    expect(await res.json()).toEqual({ ok: true });
  });

  it("aborts a hung request and rejects with TimeoutError", async () => {
    vi.useFakeTimers();
    const fetchImpl = hangingFetch();
    const pending = withRequestTimeout(fetchImpl, 1000)("http://api.test/x");
    const assertion = expect(pending).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(fetchImpl.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it("keeps the caller's own abort, which is not a timeout", async () => {
    const fetchImpl = hangingFetch();
    const controller = new AbortController();
    const pending = withRequestTimeout(fetchImpl, 60_000)("http://api.test/x", {
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.not.toBeInstanceOf(TimeoutError);
  });

  it("clears its timer once the request settles", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    await withRequestTimeout(fetchImpl, 1000)("http://api.test/x");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("never times out a write: its outcome would be unknown", async () => {
    vi.useFakeTimers();
    const fetchImpl = hangingFetch();
    withRequestTimeout(fetchImpl, 1000)("http://api.test/x", {
      method: "POST",
    });
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchImpl.mock.calls[0]?.[1]?.signal?.aborted ?? false).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("never times out a write passed as a Request either", async () => {
    vi.useFakeTimers();
    const fetchImpl = hangingFetch();
    withRequestTimeout(
      fetchImpl,
      1000
    )(new Request("http://api.test/x", { method: "POST" }));
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchImpl.mock.calls[0]?.[1]?.signal?.aborted ?? false).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
