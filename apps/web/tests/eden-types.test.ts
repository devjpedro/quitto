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

  // POST /api/contracts — { id, invite: { email, sent } | null } (phase 3), not any.
  type CreateResponse = Awaited<
    ReturnType<typeof api.api.contracts.post>
  >["data"];
  expectTypeOf<CreateResponse>().not.toBeAny();
  expectTypeOf<NonNullable<CreateResponse>>().toEqualTypeOf<{
    id: string;
    invite: { email: string; sent: boolean } | null;
  }>();

  // GET /api/contracts — response data is an array of contract summaries, not `any`.
  type ListResponse = Awaited<ReturnType<typeof api.api.contracts.get>>["data"];
  expectTypeOf<ListResponse>().not.toBeAny();
  type ListItem = NonNullable<ListResponse>[number];
  expectTypeOf<ListItem>().not.toBeAny();
  expectTypeOf<ListItem["id"]>().toEqualTypeOf<string>();
  expectTypeOf<ListItem["percent"]>().toEqualTypeOf<number>();
  expectTypeOf<ListItem["totalCents"]>().toEqualTypeOf<number>();
  // Phase 4: the list card.
  expectTypeOf<ListItem["direction"]>().toEqualTypeOf<
    "pay" | "receive" | null
  >();
  expectTypeOf<ListItem["statuses"]>().toEqualTypeOf<
    ("paid" | "overdue" | "review" | "today" | "open")[] | null
  >();

  // GET /api/contracts/:id — path param accessed by calling the segment as a function.
  // `typeof` can't wrap a call expression, so we capture the call result in a value first.
  const detailGet = api.api.contracts({ id: "x" }).get;
  type DetailResponse = Awaited<ReturnType<typeof detailGet>>["data"];
  expectTypeOf<DetailResponse>().not.toBeAny();
  expectTypeOf<NonNullable<DetailResponse>["role"]>().toEqualTypeOf<string>();
  expectTypeOf<NonNullable<DetailResponse>["installments"]>().toBeArray();

  // GET /api/contracts/:id (Fase 2, Task 2): people and the recent history.
  expectTypeOf<
    NonNullable<DetailResponse>["participants"][number]["isMe"]
  >().toEqualTypeOf<boolean>();
  expectTypeOf<NonNullable<DetailResponse>["recentEvents"]>().toBeArray();

  // GET /api/contracts/:id/events — a page and the next cursor.
  const eventsGet = api.api.contracts({ id: "x" }).events.get;
  type EventsResponse = Awaited<ReturnType<typeof eventsGet>>["data"];
  expectTypeOf<EventsResponse>().not.toBeAny();
  expectTypeOf<NonNullable<EventsResponse>["items"]>().toBeArray();
  expectTypeOf<NonNullable<EventsResponse>["nextBefore"]>().toEqualTypeOf<
    string | null
  >();

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

  // POST confirm — response is the updated installment (Fase 1, Task 5).
  const confirm = api.api.installments({ installmentId: "i" }).confirm.post;
  type ConfirmResponse = Awaited<ReturnType<typeof confirm>>["data"];
  expectTypeOf<ConfirmResponse>().not.toBeAny();
  expectTypeOf<NonNullable<ConfirmResponse>>().toEqualTypeOf<{
    id: string;
    contractId: string;
    sequence: number;
    amountCents: number;
    dueDate: string;
    status: string;
    paidAt: string | null;
    confirmedAt: string | null;
  }>();

  // GET /api/installments/:installmentId — the panel's fields (Fase 2, Task 1).
  expectTypeOf<
    NonNullable<DetailResponse>["pixMissing"]
  >().toEqualTypeOf<boolean>();
  expectTypeOf<
    NonNullable<NonNullable<DetailResponse>["pix"]>["source"]
  >().toEqualTypeOf<"account" | "contact">();
  expectTypeOf<
    NonNullable<DetailResponse>["proofs"][number]["state"]
  >().toEqualTypeOf<"current" | "disputed">();

  // POST mark-received — the updated installment, like confirm.
  const received = api.api.installments({ installmentId: "i" })["mark-received"]
    .post;
  type ReceivedResponse = Awaited<ReturnType<typeof received>>["data"];
  expectTypeOf<ReceivedResponse>().not.toBeAny();
  expectTypeOf<NonNullable<ReceivedResponse>>().toEqualTypeOf<
    NonNullable<ConfirmResponse>
  >();

  // PATCH the contact's key.
  const contactKey = api.api
    .contracts({ id: "c" })
    .participants({ participantId: "p" })["pix-key"].patch;
  type ContactKeyResponse = Awaited<ReturnType<typeof contactKey>>["data"];
  expectTypeOf<NonNullable<ContactKeyResponse>>().toEqualTypeOf<{
    id: string;
    pixKey: string | null;
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

  // GET /api/invites/:token — the phase-3 view: status and viewer, not any.
  const inviteGet = api.api.invites({ token: "t" }).get;
  type GetInviteResponse = Awaited<ReturnType<typeof inviteGet>>["data"];
  expectTypeOf<GetInviteResponse>().not.toBeAny();
  expectTypeOf<NonNullable<GetInviteResponse>["status"]>().toEqualTypeOf<
    "pending" | "accepted" | "declined" | "expired"
  >();
  expectTypeOf<NonNullable<GetInviteResponse>["viewer"]>().toEqualTypeOf<
    "invitee" | "owner" | "otherAccount" | "alreadyParticipant"
  >();
  expectTypeOf<NonNullable<GetInviteResponse>["email"]>().toEqualTypeOf<
    string | null
  >();
  // Null for another account once the invite ended (as the public preview).
  expectTypeOf<null>().toMatchTypeOf<NonNullable<GetInviteResponse>["terms"]>();

  // GET /api/invites/:token/preview — public, the minimum.
  const previewGet = api.api.invites({ token: "t" }).preview.get;
  type PreviewResponse = Awaited<ReturnType<typeof previewGet>>["data"];
  expectTypeOf<PreviewResponse>().not.toBeAny();
  expectTypeOf<
    NonNullable<PreviewResponse>["emailMasked"]
  >().toEqualTypeOf<string>();
  // The terms only while pending (planner's decision 13).
  expectTypeOf<null>().toMatchTypeOf<NonNullable<PreviewResponse>["terms"]>();

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

it("infers GET /api/home cross-package (eden#215 mitigation)", () => {
  const api = treaty<App>("http://localhost:3000");
  type HomeData = Awaited<ReturnType<typeof api.api.home.get>>["data"];
  expectTypeOf<HomeData>().not.toBeAny();
  expectTypeOf<NonNullable<HomeData>["unreadCount"]>().toEqualTypeOf<number>();
  expectTypeOf<
    NonNullable<HomeData>["activeContractsCount"]
  >().toEqualTypeOf<number>();
  expectTypeOf<
    NonNullable<HomeData>["actions"][number]["kind"]
  >().toEqualTypeOf<
    "overdue" | "review" | "disputed" | "due_soon" | "invite"
  >();
  expectTypeOf<NonNullable<HomeData>["milestones"]["settled"]>().toEqualTypeOf<{
    paidCents: number;
    receivedCents: number;
    payableTotalCents: number;
    receivableTotalCents: number;
  }>();
  // The closest-to-payoff milestone brings what's left and when the next one
  // is due; nextDueDate is null-able, never optional (no undefined).
  type HomeClosest = NonNullable<
    NonNullable<HomeData>["milestones"]["closestToPayoff"]
  >;
  expectTypeOf<HomeClosest["remainingCount"]>().toEqualTypeOf<number>();
  expectTypeOf<HomeClosest["nextDueDate"]>().toEqualTypeOf<string | null>();
  // Every installment card carries its contract's summary; statuses is null
  // above 24 installments, never optional (planner's decision 4: no undefined).
  type HomeInstallmentAction = Exclude<
    NonNullable<HomeData>["actions"][number],
    { kind: "invite" }
  >;
  expectTypeOf<HomeInstallmentAction["contract"]>().toEqualTypeOf<{
    paidCount: number;
    overdueCount: number;
    remainingCents: number;
    statuses: ("paid" | "overdue" | "review" | "today" | "open")[] | null;
  }>();
  // The invite card's terms: amountCents is null when the installments have
  // different amounts, and firstDueDate is null-able; both never optional.
  type HomeInviteAction = Extract<
    NonNullable<HomeData>["actions"][number],
    { kind: "invite" }
  >;
  expectTypeOf<HomeInviteAction["installmentsCount"]>().toEqualTypeOf<number>();
  expectTypeOf<HomeInviteAction["amountCents"]>().toEqualTypeOf<
    number | null
  >();
  expectTypeOf<HomeInviteAction["totalCents"]>().toEqualTypeOf<number>();
  expectTypeOf<HomeInviteAction["firstDueDate"]>().toEqualTypeOf<
    string | null
  >();
  // The sidebar's active contracts, and the two facts the guide hides itself by.
  expectTypeOf<
    NonNullable<HomeData>["activeContracts"][number]
  >().toEqualTypeOf<{
    contractId: string;
    title: string;
    paidCount: number;
    totalCount: number;
    hasOverdue: boolean;
  }>();
  expectTypeOf<
    NonNullable<HomeData>["onboarding"]["accountCreatedOn"]
  >().toEqualTypeOf<string>();
  expectTypeOf<
    NonNullable<HomeData>["onboarding"]["activePartyContracts"]
  >().toEqualTypeOf<number>();
});

it("infers the Fase-4 installments list cross-package", () => {
  const api = treaty<App>("http://localhost:3000");
  type ListResponse = Awaited<
    ReturnType<typeof api.api.installments.get>
  >["data"];
  expectTypeOf<ListResponse>().not.toBeAny();
  type Item = NonNullable<ListResponse>["items"][number];
  expectTypeOf<Item["direction"]>().toEqualTypeOf<"pay" | "receive">();
  expectTypeOf<NonNullable<ListResponse>["today"]>().toEqualTypeOf<string>();
  // The query accepts the window, the side, the state and pastDue.
  expectTypeOf(api.api.installments.get).parameter(0).not.toBeAny();

  // The detail keeps its own type.
  const detailGet = api.api.installments({ installmentId: "x" }).get;
  type DetailResponse = Awaited<ReturnType<typeof detailGet>>["data"];
  expectTypeOf<NonNullable<DetailResponse>["proofs"]>().toBeArray();
});
