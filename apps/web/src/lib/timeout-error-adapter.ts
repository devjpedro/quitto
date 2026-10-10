import { createSerializationAdapter } from "@tanstack/react-router";
import { isTimeoutError, TimeoutError } from "@/lib/with-timeout";

/**
 * Carries a TimeoutError across the SSR stream. The Start's default plugin
 * keeps only an error's message, so a read that timed out on the server would
 * reach the browser as a plain Error: retried behind the user's back instead
 * of showing "Tentar de novo" right away. Registered in src/start.ts, ahead of
 * the default plugins.
 */
export const timeoutErrorAdapter = createSerializationAdapter({
  key: "timeout-error",
  test: (value): value is TimeoutError => isTimeoutError(value),
  toSerializable: () => null,
  fromSerializable: () => new TimeoutError(),
});
