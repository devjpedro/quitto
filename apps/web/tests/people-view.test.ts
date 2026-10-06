import { describe, expect, it } from "vitest";
import {
  inviteCardOf,
  personRowView,
} from "@/features/contracts/lib/people-view";
import { motoDetail } from "./contract-fixtures";

const [joao, rafa, silvia] = motoDetail().participants;
const owner = { viewerIsOwner: true, locale: "pt-BR" as const };

describe("personRowView (Pessoas, enxuto)", () => {
  it("você: tag 'Você', e-mail e 'criou o contrato em 28/06', papel Recebe; sem ações", () => {
    expect(personRowView(joao as never, owner)).toEqual({
      tag: { text: "Você", tone: "neutral", icon: null },
      meta: "joao.souza@exemplo.com · criou o contrato em 28/06",
      role: { text: "Recebe", icon: "receive" },
      actions: [],
      removable: false,
    });
  });

  it("quem paga, com conta: sem tag, e-mail e 'no contrato desde 29/06'; o dono pode remover", () => {
    expect(personRowView(rafa as never, owner)).toMatchObject({
      tag: null,
      meta: "rafa@demo.quitto.dev · no contrato desde 29/06",
      role: { text: "Paga", icon: "pay" },
      removable: true,
    });
  });

  it("convite pendente: a tag diz que é convite; o metadado é só o e-mail e quando foi; reenviar e copiar", () => {
    expect(personRowView(silvia as never, owner)).toMatchObject({
      tag: { text: "Convite pendente", tone: "warning", icon: "envelope" },
      meta: "silvia@demo.quitto.dev · enviado em 01/10",
      role: { text: "Acompanha", icon: "watch" },
      actions: ["resend", "copy_link"],
    });
  });

  it("quem não é dono: sem ações e sem remover (e o e-mail dos outros já vem nulo da API)", () => {
    const silviaSeen = {
      ...(silvia as object),
      email: null,
      invite: {
        status: "pending",
        sentAt: "2026-10-01T12:00:00.000Z",
        url: null,
      },
    };
    expect(
      personRowView(silviaSeen as never, { ...owner, viewerIsOwner: false })
    ).toMatchObject({
      meta: "enviado em 01/10",
      actions: [],
      removable: false,
    });
  });

  it("só o nome: a tag diz, e nada embaixo", () => {
    const marina = {
      id: "p-m",
      displayName: "Marina Pires",
      role: "buyer",
      linked: false,
      isOwner: false,
      isMe: false,
      email: null,
      invite: null,
      joinedAt: null,
    };
    expect(personRowView(marina as never, owner)).toMatchObject({
      tag: { text: "Só o nome", tone: "neutral" },
      meta: null,
    });
  });
});

describe("inviteCardOf", () => {
  it("a outra parte só com o nome vira o convite tracejado (só para o dono)", () => {
    const marina = {
      id: "p-m",
      displayName: "Marina Pires",
      role: "buyer",
      linked: false,
      isOwner: false,
      isMe: false,
      email: null,
      invite: null,
      joinedAt: null,
    };
    const detail = motoDetail({
      participants: [joao as never, marina as never],
    });
    expect(inviteCardOf(detail)).toEqual({ participant: marina, pays: true });
    expect(inviteCardOf({ ...detail, isOwner: false })).toBeNull();
    expect(inviteCardOf(motoDetail())).toBeNull();
  });
});
