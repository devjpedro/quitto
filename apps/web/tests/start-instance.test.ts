import { describe, expect, it } from "vitest";
import { timeoutErrorAdapter } from "../src/lib/timeout-error-adapter";
import { startInstance } from "../src/start";

interface RequestMiddleware {
  options: {
    server: (ctx: {
      handlerType: string;
      next: () => Promise<string>;
      request: Request;
    }) => Promise<unknown>;
  };
}

const SERVER_FN_URL = "http://localhost:3001/_serverFn/abc";

/** Runs the start instance's request middleware for a server function call. */
async function callServerFn(fetchSite: string): Promise<unknown> {
  const options = await startInstance.getOptions();
  const [csrf] = (options.requestMiddleware ??
    []) as unknown as RequestMiddleware[];
  if (!csrf) {
    return "no request middleware";
  }
  return csrf.options.server({
    handlerType: "serverFn",
    request: new Request(SERVER_FN_URL, {
      method: "POST",
      headers: { "Sec-Fetch-Site": fetchSite },
    }),
    next: () => Promise.resolve("handled"),
  });
}

describe("start instance", () => {
  // Without an instance the Start applies this check by default; with one,
  // only the instance's request middleware runs.
  it("still refuses a cross-site call to a server function", async () => {
    const response = await callServerFn("cross-site");
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(403);
  });

  it("lets a same-origin call to a server function through", async () => {
    expect(await callServerFn("same-origin")).toBe("handled");
  });

  it("hands the router the timeout adapter", async () => {
    const options = await startInstance.getOptions();
    expect(options.serializationAdapters).toContain(timeoutErrorAdapter);
  });
});
