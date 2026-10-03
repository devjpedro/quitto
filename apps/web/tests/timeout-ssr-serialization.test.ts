import {
  type AnySerializationAdapter,
  defaultSerovalPlugins,
  makeSsrSerovalPlugin,
} from "@tanstack/router-core";
import { crossSerializeStream } from "seroval";
import { describe, expect, it } from "vitest";
import { shouldRetryQuery } from "../src/lib/query";
import { isTimeoutError, TimeoutError } from "../src/lib/with-timeout";
import { getRouter } from "../src/router";
import { startInstance } from "../src/start";

// The SSR streams a pending query's rejection to the browser as script, and
// the browser runs it. These helpers do the same two halves the Start does
// (router-core ssr-server and ssr-client), with the app's own adapters, so
// what reaches the query is exactly what the browser would see.
// router-core and seroval are devDependencies pinned exact for this test;
// ssr-serialization-pins.test.ts fails when they part from the app's copies.

const SCOPE_ID = "tsr";

/** The adapters the Start hands the router: the start instance's, then the router's own. */
async function appAdapters(): Promise<readonly AnySerializationAdapter[]> {
  const options = await startInstance.getOptions();
  return [
    ...(options.serializationAdapters ?? []),
    ...(getRouter().options.serializationAdapters ?? []),
  ];
}

/** ssr-server: the router's adapters ahead of the default plugins, streamed. */
function serializeLikeTheSsr(
  value: unknown,
  adapters: readonly AnySerializationAdapter[]
): Promise<string[]> {
  const track = { didRun: false };
  const plugins = [
    ...adapters.map((adapter) => makeSsrSerovalPlugin(adapter, track)),
    ...defaultSerovalPlugins,
  ];
  const scripts: string[] = [];
  return new Promise((resolve, reject) => {
    crossSerializeStream(value, {
      refs: new Map(),
      plugins,
      scopeId: SCOPE_ID,
      onSerialize: (data, initial) => {
        scripts.push(initial ? `out.value=${data}` : data);
      },
      onError: reject,
      onDone: () => resolve(scripts),
    });
  });
}

/** ssr-client: each adapter's fromSerializable on $_TSR.t, then the scripts run. */
function runLikeTheBrowser(
  scripts: string[],
  adapters: readonly AnySerializationAdapter[]
): unknown {
  const $R: Record<string, unknown[]> = { [SCOPE_ID]: [] };
  const $_TSR = {
    t: new Map(
      adapters.map((adapter) => [adapter.key, adapter.fromSerializable])
    ),
  };
  const out: { value?: unknown } = {};
  for (const script of scripts) {
    new Function("$R", "$_TSR", "out", script)($R, $_TSR, out);
  }
  return out.value;
}

async function roundTrip(value: unknown): Promise<unknown> {
  const adapters = await appAdapters();
  return runLikeTheBrowser(
    await serializeLikeTheSsr(value, adapters),
    adapters
  );
}

describe("a timeout that crosses the SSR stream", () => {
  it("is still a timeout when the pending query's promise rejects with it", async () => {
    const streamed = (await roundTrip({
      promise: Promise.reject(new TimeoutError()),
    })) as { promise: Promise<unknown> };
    const error = await streamed.promise.catch((reason: unknown) => reason);
    expect(isTimeoutError(error)).toBe(true);
    // No hidden retry: the section shows "Tentar de novo" at once.
    expect(shouldRetryQuery(0, error)).toBe(false);
  });

  it("is still a timeout when the query had already failed with it", async () => {
    const streamed = (await roundTrip({ error: new TimeoutError() })) as {
      error: unknown;
    };
    expect(isTimeoutError(streamed.error)).toBe(true);
    expect(shouldRetryQuery(0, streamed.error)).toBe(false);
  });

  it("leaves any other error as a plain message, retried once", async () => {
    const streamed = (await roundTrip({ error: new Error("boom") })) as {
      error: unknown;
    };
    expect(streamed.error).toBeInstanceOf(Error);
    expect((streamed.error as Error).message).toBe("boom");
    expect(isTimeoutError(streamed.error)).toBe(false);
    expect(shouldRetryQuery(0, streamed.error)).toBe(true);
  });
});
