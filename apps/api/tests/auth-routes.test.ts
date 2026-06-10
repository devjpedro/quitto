import { describe, expect, it } from "bun:test";
import { app } from "../src/app";

describe("routing", () => {
  it("ainda serve /api/ping (negócio)", async () => {
    const res = await app.handle(new Request("http://localhost/api/ping"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", service: "quitto-api" });
  });

  it("serve as rotas do Better Auth em /api/auth/*", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/auth/get-session", {
        headers: { cookie: "" },
      })
    );
    expect(res.status).toBe(200);
  });
});
