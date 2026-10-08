import { describe, expect, it } from "vitest";
import { createdToast } from "@/features/contract-wizard/lib/created-toast";

describe("createdToast (3 variantes, decisão 17 do dono)", () => {
  it("sem outra parte (ou sem e-mail): só 'Contrato criado'", () => {
    expect(createdToast(null)).toEqual({
      kind: "success",
      title: "Contrato criado",
    });
  });

  it("convite enviado: diz para quem", () => {
    expect(
      createdToast({ email: "renata.campos@exemplo.com", sent: true })
    ).toEqual({
      kind: "success",
      title: "Contrato criado",
      description: "Convite enviado para renata.campos@exemplo.com.",
    });
  });

  it("o e-mail falhou: aviso, para reenviar pelo contrato", () => {
    expect(createdToast({ email: "renata@exemplo.com", sent: false })).toEqual({
      kind: "warning",
      title: "Contrato criado, mas o convite não saiu. Reenvie pelo contrato.",
    });
  });
});
