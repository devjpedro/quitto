import { expect, test, vi } from "vitest";
import { resolveSessionSSR, SESSION_SSR_TIMEOUT_MS } from "@/lib/session-resolver";

const ok = (user: unknown) =>
  new Response(JSON.stringify(user), { status: 200 });

test("sem cookie → anon (nem tenta a rede)", async () => {
  const fetchMe = vi.fn();
  const r = await resolveSessionSSR({ cookie: null, fetchMe, timeoutMs: 50 });
  expect(r.status).toBe("anon");
  expect(fetchMe).not.toHaveBeenCalled();
});

test("200 (quente) → authed com user", async () => {
  const fetchMe = vi.fn().mockResolvedValue(ok({ id: "u1", email: "a@b.c" }));
  const r = await resolveSessionSSR({ cookie: "s=1", fetchMe, timeoutMs: 1500 });
  expect(r).toEqual({ status: "authed", user: { id: "u1", email: "a@b.c" } });
});

test("401 → anon", async () => {
  const fetchMe = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
  const r = await resolveSessionSSR({ cookie: "s=1", fetchMe, timeoutMs: 1500 });
  expect(r.status).toBe("anon");
});

test("timeout (fria) → unknown", async () => {
  const fetchMe = vi.fn().mockImplementation(() => new Promise(() => {})); // nunca resolve
  const r = await resolveSessionSSR({ cookie: "s=1", fetchMe, timeoutMs: 20 });
  expect(r.status).toBe("unknown");
});

test("erro 5xx transitório → unknown (cliente reassume)", async () => {
  const fetchMe = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
  const r = await resolveSessionSSR({ cookie: "s=1", fetchMe, timeoutMs: 1500 });
  expect(r.status).toBe("unknown");
});

test("timeout padrão é 1500ms", () => {
  expect(SESSION_SSR_TIMEOUT_MS).toBe(1500);
});
