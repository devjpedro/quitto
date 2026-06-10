// COMPILE-TIME PROOF — enforced by `tsc --noEmit` via the `typecheck` script (runs in CI).
// `vitest run` erases types at runtime, so the `expectTypeOf` assertions below are no-ops there.
// Never weaken these assertions: `typecheck` is the only gate that catches type regressions.

import { treaty } from "@elysiajs/eden";
import type { App } from "@quitto/api";
import { expectTypeOf, it } from "vitest";

it("infers the Eden response type cross-package (eden#215 mitigation)", () => {
  const api = treaty<App>("http://localhost:3000");
  type PingResponse = Awaited<ReturnType<typeof api.api.ping.get>>["data"];
  // If Better Auth broke the types, this would be `any` and the test would fail.
  expectTypeOf<PingResponse>().not.toBeAny();
  expectTypeOf<NonNullable<PingResponse>>().toEqualTypeOf<{
    status: "ok";
    service: string;
  }>();
});
