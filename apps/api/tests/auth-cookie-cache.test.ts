import { describe, expect, it } from "bun:test";
import { app } from "../src/app";
import { signUpCookie, uniqueEmail } from "./helpers/auth";

describe("cookie cache da sessão", () => {
  it("o sign-in entrega o cookie session_data junto com o session_token", async () => {
    const cookie = await signUpCookie(uniqueEmail("cache"));
    expect(cookie).toContain("session_token=");
    expect(cookie).toContain("session_data=");
  });

  it("a sessão continua válida para a API usando os dois cookies", async () => {
    const cookie = await signUpCookie(uniqueEmail("cache2"));
    const res = await app.handle(
      new Request("http://localhost/api/me", { headers: { cookie } })
    );
    expect(res.status).toBe(200);
  });
});
