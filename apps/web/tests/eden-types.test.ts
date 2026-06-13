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

it("infers the Fase-3a installment endpoints cross-package (eden#215 mitigation)", () => {
  const api = treaty<App>("http://localhost:3000");

  // GET /api/installments/:installmentId — detail with proofs + events.
  const detailGet = api.api.installments({ installmentId: "i" }).get;
  type DetailResponse = Awaited<ReturnType<typeof detailGet>>["data"];
  expectTypeOf<DetailResponse>().not.toBeAny();
  expectTypeOf<NonNullable<DetailResponse>["status"]>().toEqualTypeOf<string>();
  expectTypeOf<NonNullable<DetailResponse>["proofs"]>().toBeArray();
  expectTypeOf<NonNullable<DetailResponse>["events"]>().toBeArray();

  // POST presign — response is { uploadUrl, objectKey }.
  const presign = api.api.installments({ installmentId: "i" }).proofs.presign
    .post;
  type PresignResponse = Awaited<ReturnType<typeof presign>>["data"];
  expectTypeOf<PresignResponse>().not.toBeAny();
  expectTypeOf<NonNullable<PresignResponse>>().toEqualTypeOf<{
    uploadUrl: string;
    objectKey: string;
  }>();

  // POST confirm — response is { status }.
  const confirm = api.api.installments({ installmentId: "i" }).confirm.post;
  type ConfirmResponse = Awaited<ReturnType<typeof confirm>>["data"];
  expectTypeOf<ConfirmResponse>().not.toBeAny();
  expectTypeOf<NonNullable<ConfirmResponse>>().toEqualTypeOf<{
    status: string;
  }>();
});

it("infers the Fase-4a participants/invites endpoints cross-package (eden#215 mitigation)", () => {
  const api = treaty<App>("http://localhost:3000");

  // POST /api/contracts/:id/participants — response is { id: string }.
  const participantsPost = api.api.contracts({ id: "x" }).participants.post;
  type CreateParticipantResponse = Awaited<
    ReturnType<typeof participantsPost>
  >["data"];
  expectTypeOf<CreateParticipantResponse>().not.toBeAny();
  expectTypeOf<NonNullable<CreateParticipantResponse>>().toEqualTypeOf<{
    id: string;
  }>();

  // DELETE /api/contracts/:id/participants/:participantId — response is { ok: true }.
  const participantsDelete = api.api
    .contracts({ id: "x" })
    .participants({ participantId: "y" }).delete;
  type DeleteParticipantResponse = Awaited<
    ReturnType<typeof participantsDelete>
  >["data"];
  expectTypeOf<DeleteParticipantResponse>().not.toBeAny();
  expectTypeOf<NonNullable<DeleteParticipantResponse>>().toEqualTypeOf<{
    ok: true;
  }>();

  // POST /api/contracts/:id/participants/:participantId/invite — response is { token, expiresAt }.
  const invitePost = api.api
    .contracts({ id: "x" })
    .participants({ participantId: "y" }).invite.post;
  type CreateInviteResponse = Awaited<ReturnType<typeof invitePost>>["data"];
  expectTypeOf<CreateInviteResponse>().not.toBeAny();
  expectTypeOf<NonNullable<CreateInviteResponse>>().toEqualTypeOf<{
    token: string;
    expiresAt: string;
  }>();

  // GET /api/invites/:token — response is { contractTitle, role, email, emailMatches }.
  const inviteGet = api.api.invites({ token: "t" }).get;
  type GetInviteResponse = Awaited<ReturnType<typeof inviteGet>>["data"];
  expectTypeOf<GetInviteResponse>().not.toBeAny();
  expectTypeOf<
    NonNullable<GetInviteResponse>["contractTitle"]
  >().toEqualTypeOf<string>();
  expectTypeOf<
    NonNullable<GetInviteResponse>["role"]
  >().toEqualTypeOf<string>();
  expectTypeOf<
    NonNullable<GetInviteResponse>["email"]
  >().toEqualTypeOf<string>();
  expectTypeOf<
    NonNullable<GetInviteResponse>["emailMatches"]
  >().toEqualTypeOf<boolean>();

  // POST /api/invites/:token/accept — response is { contractId: string }.
  const acceptPost = api.api.invites({ token: "t" }).accept.post;
  type AcceptInviteResponse = Awaited<ReturnType<typeof acceptPost>>["data"];
  expectTypeOf<AcceptInviteResponse>().not.toBeAny();
  expectTypeOf<NonNullable<AcceptInviteResponse>>().toEqualTypeOf<{
    contractId: string;
  }>();

  // GET /api/invites/mine — response is an array of pending invites.
  const mineGet = api.api.invites.mine.get;
  type MineResponse = Awaited<ReturnType<typeof mineGet>>["data"];
  expectTypeOf<MineResponse>().not.toBeAny();
  type MineItem = NonNullable<MineResponse>[number];
  expectTypeOf<MineItem["token"]>().toEqualTypeOf<string>();
  expectTypeOf<MineItem["contractTitle"]>().toEqualTypeOf<string>();
  expectTypeOf<MineItem["role"]>().toEqualTypeOf<string>();
  expectTypeOf<MineItem["expiresAt"]>().toEqualTypeOf<string>();
});
