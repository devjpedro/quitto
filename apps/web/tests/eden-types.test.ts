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

it("infers the Fase-2a contract endpoints cross-package (eden#215 mitigation)", () => {
  const api = treaty<App>("http://localhost:3000");

  // POST /api/contracts — response data is `{ id: string }`, not `any`.
  type CreateResponse = Awaited<
    ReturnType<typeof api.api.contracts.post>
  >["data"];
  expectTypeOf<CreateResponse>().not.toBeAny();
  expectTypeOf<NonNullable<CreateResponse>>().toEqualTypeOf<{ id: string }>();

  // GET /api/contracts — response data is an array of contract summaries, not `any`.
  type ListResponse = Awaited<ReturnType<typeof api.api.contracts.get>>["data"];
  expectTypeOf<ListResponse>().not.toBeAny();
  type ListItem = NonNullable<ListResponse>[number];
  expectTypeOf<ListItem>().not.toBeAny();
  expectTypeOf<ListItem["id"]>().toEqualTypeOf<string>();
  expectTypeOf<ListItem["percent"]>().toEqualTypeOf<number>();
  expectTypeOf<ListItem["totalCents"]>().toEqualTypeOf<number>();

  // GET /api/contracts/:id — path param accessed by calling the segment as a function.
  // `typeof` can't wrap a call expression, so we capture the call result in a value first.
  const detailGet = api.api.contracts({ id: "x" }).get;
  type DetailResponse = Awaited<ReturnType<typeof detailGet>>["data"];
  expectTypeOf<DetailResponse>().not.toBeAny();
  expectTypeOf<NonNullable<DetailResponse>["role"]>().toEqualTypeOf<string>();
  expectTypeOf<NonNullable<DetailResponse>["installments"]>().toBeArray();

  // PATCH /api/contracts/:id/installments/:installmentId — two path params.
  const patch = api.api
    .contracts({ id: "x" })
    .installments({ installmentId: "y" }).patch;
  type PatchResponse = Awaited<ReturnType<typeof patch>>["data"];
  expectTypeOf<PatchResponse>().not.toBeAny();
  expectTypeOf<NonNullable<PatchResponse>>().toEqualTypeOf<{ id: string }>();
});
