import { isRedirect } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { Route as LoginRoute } from "../src/routes/login";

type BeforeLoad = (args: { context: { session: string } }) => unknown;
const beforeLoad = LoginRoute.options.beforeLoad as unknown as BeforeLoad;

function attempt(session: string): unknown {
  try {
    return beforeLoad({ context: { session } });
  } catch (error) {
    return error;
  }
}

describe("/login com sessão", () => {
  it("quem está logado vai para /", () => {
    const thrown = attempt("authed");
    expect(isRedirect(thrown)).toBe(true);
    expect((thrown as { options: { to: string } }).options.to).toBe("/");
  });

  it("anônimo, desconhecido (API fria) e cliente ficam na página", () => {
    for (const session of ["anon", "unknown", "client"]) {
      expect(isRedirect(attempt(session))).toBe(false);
    }
  });
});
