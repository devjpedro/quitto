import { describe, expect, it } from "vitest";
import { roleLabel } from "@/features/invites/lib/invite-format";
import { invitePreviewModel } from "@/features/invites/lib/invite-preview-model";
import { inviteScreen } from "@/features/invites/lib/invite-screen";
import { FLORIPA } from "./invite-fixtures";

describe("inviteScreen (status × viewer)", () => {
  it.each([
    ["invitee", "pending", "decide"],
    ["invitee", "accepted", "accepted"],
    ["invitee", "declined", "declined"],
    ["invitee", "expired", "expired"],
    ["owner", "pending", "owner"],
    ["owner", "accepted", "owner"],
    ["otherAccount", "pending", "otherAccount"],
    ["otherAccount", "expired", "otherAccount"],
    ["alreadyParticipant", "pending", "participant"],
  ] as const)("%s + %s → %s", (viewer, status, kind) => {
    expect(
      inviteScreen({ kind: "view", view: { ...FLORIPA, viewer, status } }).kind
    ).toBe(kind);
  });

  it("sem sessão e token que não existe", () => {
    expect(inviteScreen({ kind: "guest" })).toEqual({ kind: "guest" });
    expect(inviteScreen({ kind: "missing" })).toEqual({ kind: "missing" });
  });
});

describe("invitePreviewModel", () => {
  it("do lado de quem foi convidado: 'Você paga', 'para Bia Lopes', as 3 primeiras", () => {
    expect(invitePreviewModel(FLORIPA)).toMatchObject({
      side: "pay",
      title: "Viagem para Floripa (dividida)",
      totalCents: 120_000,
      summary: { kind: "even", amountCents: 30_000, count: 4, day: 10 },
      person: { kind: "other", name: "Bia Lopes" },
      count: 4,
      lastDueDate: "2027-02-10",
    });
    expect(invitePreviewModel(FLORIPA).rows).toHaveLength(3);
  });

  it("o papel numa frase", () => {
    expect(roleLabel("buyer")).toBe("quem paga");
    expect(roleLabel("viewer")).toBe("quem acompanha");
  });

  it("vaga de quem recebe: 'Você recebe'; espectador: 'Você acompanha'", () => {
    expect(invitePreviewModel({ ...FLORIPA, role: "seller" }).side).toBe(
      "receive"
    );
    expect(invitePreviewModel({ ...FLORIPA, role: "viewer" }).side).toBe(
      "follow"
    );
  });

  it("sem condições (outra conta, convite encerrado): só quem e o quê, sem parcelas", () => {
    const model = invitePreviewModel({
      ...FLORIPA,
      terms: null,
      schedulePreview: [],
    });
    expect(model).toMatchObject({
      totalCents: null,
      summary: null,
      rows: [],
      count: 0,
    });
    expect(model.person).toEqual({ kind: "other", name: "Bia Lopes" });
  });
});
