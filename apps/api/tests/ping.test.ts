import { describe, expect, it } from "bun:test";
import { treaty } from "@elysiajs/eden";
import { app } from "../src/app";

const api = treaty(app);

describe("GET /api/ping", () => {
  it("returns typed ok status (not any)", async () => {
    const { data, error } = await api.api.ping.get();
    expect(error).toBeNull();
    expect(data).toEqual({ status: "ok", service: "quitto-api" });
    // type proof: the line below only compiles if `data` is correctly typed
    const status: "ok" | undefined = data?.status;
    expect(status).toBe("ok");
  });
});
