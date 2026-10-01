import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Elysia } from "elysia";
import { internalCronModule } from "../src/modules/internal-cron";

const SECRET = "s".repeat(40);
const run = mock(async () => ({ reminders: 2, emailsSent: 1 }));
const call = (secret: string | undefined, auth?: string) =>
  new Elysia().use(internalCronModule({ secret, run })).handle(
    new Request("http://localhost/api/internal/cron/reminders", {
      method: "POST",
      headers: auth ? { authorization: auth } : {},
    })
  );

describe("POST /api/internal/cron/reminders", () => {
  beforeEach(() => run.mockClear());

  it("sem secret configurado → 404", async () => {
    expect((await call(undefined, `Bearer ${SECRET}`)).status).toBe(404);
    expect(run).not.toHaveBeenCalled();
  });
  it("sem header → 401", async () => {
    expect((await call(SECRET)).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });
  it("secret errado (inclusive tamanho diferente) → 401", async () => {
    expect((await call(SECRET, "Bearer errado")).status).toBe(401);
    expect((await call(SECRET, `Bearer ${"t".repeat(40)}`)).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });
  it("secret certo → 200 com as contagens", async () => {
    const res = await call(SECRET, `Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reminders: 2, emailsSent: 1 });
    expect(run).toHaveBeenCalledTimes(1);
  });
});
