import { describe, expect, it } from "vitest";
import {
  panelInputOf,
  panelView,
} from "@/features/installments/lib/panel-actions";

const base = {
  caps: { isApprover: true, isPayer: false },
  counterpartHasAccount: true,
  isOwner: true,
  requiresConfirmation: true,
  hasProof: false,
};

describe("panelView (spec §4.1, mockup 14 §2)", () => {
  it("P1/P2: quem paga uma parcela em aberto: PIX (ou a falta dele), envio e, sem confirmação, marcar sem comprovante", () => {
    const pay = {
      ...base,
      perspective: "pay" as const,
      caps: { isApprover: false, isPayer: true },
      isOwner: false,
    };
    expect(panelView({ ...pay, status: "pending" })).toEqual({
      blocks: ["pix", "upload"],
      primary: "send_proof",
    });
    expect(
      panelView({ ...pay, status: "pending", requiresConfirmation: false })
    ).toEqual({
      blocks: ["pix", "upload", "mark_paid_link"],
      primary: "send_proof",
    });
  });

  it("P3: quem recebe uma parcela em aberto: cobrar e marcar como recebida", () => {
    expect(
      panelView({ ...base, perspective: "receive", status: "pending" })
    ).toEqual({
      blocks: ["charge", "mark_received"],
      primary: "whatsapp_charge",
    });
  });

  it("P4: quem confere um comprovante: a prévia e confirmar/contestar; quem pagou só vê o seu envio", () => {
    expect(
      panelView({
        ...base,
        perspective: "receive",
        status: "awaiting_confirmation",
        hasProof: true,
      })
    ).toEqual({
      blocks: ["proof_review", "review_actions"],
      primary: "confirm",
    });
    expect(
      panelView({
        ...base,
        perspective: "pay",
        caps: { isApprover: false, isPayer: true },
        isOwner: false,
        status: "awaiting_confirmation",
        hasProof: true,
      })
    ).toEqual({ blocks: ["proofs"], primary: null });
  });

  it("P4: o dono que paga e herda a aprovação (ninguém do outro lado com conta) também confere (M3)", () => {
    expect(
      panelView({
        ...base,
        perspective: "pay",
        caps: { isApprover: true, isPayer: true },
        status: "awaiting_confirmation",
        hasProof: true,
      })
    ).toEqual({
      blocks: ["proof_review", "review_actions"],
      primary: "confirm",
    });
  });

  it("P5: paga: o recibo (o dono compartilha; os outros, o PDF) e os comprovantes", () => {
    expect(
      panelView({
        ...base,
        perspective: "receive",
        status: "confirmed",
        hasProof: true,
      })
    ).toEqual({ blocks: ["receipt", "proofs"], primary: "share_receipt" });
    expect(
      panelView({
        ...base,
        perspective: "pay",
        isOwner: false,
        caps: { isApprover: false, isPayer: true },
        status: "paid",
        hasProof: false,
      })
    ).toEqual({ blocks: ["receipt"], primary: "receipt_pdf" });
  });

  it("P5: o dono que recebe de quem não tem conta manda o recibo pelo WhatsApp (I7)", () => {
    expect(
      panelView({
        ...base,
        perspective: "receive",
        counterpartHasAccount: false,
        status: "paid",
        hasProof: false,
      })
    ).toEqual({ blocks: ["receipt"], primary: "whatsapp_receipt" });
  });

  it("P6: contestada: quem paga vê a contestação e reenvia; quem recebe vê e pode marcar como recebida", () => {
    expect(
      panelView({
        ...base,
        perspective: "pay",
        caps: { isApprover: false, isPayer: true },
        isOwner: false,
        status: "disputed",
        hasProof: true,
      })
    ).toEqual({
      blocks: ["dispute", "proofs", "reupload"],
      primary: "send_proof",
    });
    expect(
      panelView({
        ...base,
        perspective: "receive",
        status: "disputed",
        hasProof: true,
      })
    ).toEqual({
      blocks: ["dispute", "proofs", "mark_received"],
      primary: null,
    });
  });

  it("espectador: nenhuma ação; vê o comprovante e os envios", () => {
    const view = {
      ...base,
      perspective: "view" as const,
      caps: { isApprover: false, isPayer: false },
      isOwner: false,
    };
    expect(panelView({ ...view, status: "pending" })).toEqual({
      blocks: [],
      primary: null,
    });
    expect(
      panelView({ ...view, status: "awaiting_confirmation", hasProof: true })
    ).toEqual({ blocks: ["proof_review"], primary: null });
    expect(panelView({ ...view, status: "confirmed", hasProof: true })).toEqual(
      { blocks: ["proofs"], primary: null }
    );
  });
});

describe("panelInputOf", () => {
  const contract = {
    role: "seller",
    isOwner: true,
    isApprover: true,
    isPayer: false,
    contract: { requiresConfirmation: true },
    participants: [
      { role: "seller", linked: true },
      { role: "buyer", linked: false },
    ],
  };

  it("a outra parte de quem recebe é quem paga: sem conta, counterpartHasAccount falso", () => {
    expect(panelInputOf(contract, { status: "paid", proofs: [{}] })).toEqual({
      caps: { isApprover: true, isPayer: false },
      counterpartHasAccount: false,
      hasProof: true,
      isOwner: true,
      perspective: "receive",
      requiresConfirmation: true,
      status: "paid",
    });
  });

  it("sem ninguém do outro lado, ninguém recebe o WhatsApp (conta como com conta)", () => {
    expect(
      panelInputOf(
        { ...contract, participants: [{ role: "seller", linked: true }] },
        { status: "paid", proofs: [] }
      ).counterpartHasAccount
    ).toBe(true);
  });
});
