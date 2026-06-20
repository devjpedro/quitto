import { describe, expect, it } from "bun:test";
import { app } from "../src/app";
import { buildStatementCsv } from "../src/lib/documents/csv";
import {
  buildReceiptModel,
  buildStatementModel,
  type ModelContract,
  type ModelInstallment,
  type ModelParticipant,
} from "../src/lib/documents/model";
import { renderReceiptPdf, renderStatementPdf } from "../src/lib/documents/pdf";
import { signUpCookie, uniqueEmail } from "./helpers/auth";

const contract: ModelContract = {
  title: "Aluguel",
  installmentsCount: 2,
};
const participants: ModelParticipant[] = [
  { role: "buyer", displayName: "Comprador" },
  { role: "seller", displayName: "Vendedor" },
];
const today = "2026-07-15";

const mkInst = (over: Partial<ModelInstallment>): ModelInstallment => ({
  sequence: 1,
  amountCents: 1000,
  dueDate: "2026-07-10",
  status: "pending",
  paidAt: null,
  ...over,
});

describe("buildStatementModel", () => {
  it("maps parties by slot and builds rows sorted by sequence", () => {
    const model = buildStatementModel(
      contract,
      [mkInst({ sequence: 2, dueDate: "2026-08-10" }), mkInst({ sequence: 1 })],
      participants,
      today
    );
    expect(model.parties).toEqual({
      payerName: "Comprador",
      receiverName: "Vendedor",
    });
    expect(model.rows.map((r) => r.sequence)).toEqual([1, 2]);
    expect(model.isFullyPaid).toBe(false);
  });

  it("flags fully paid and the last paid date", () => {
    const model = buildStatementModel(
      contract,
      [
        mkInst({ sequence: 1, status: "paid", paidAt: "2026-07-01" }),
        mkInst({ sequence: 2, status: "confirmed", paidAt: "2026-07-12" }),
      ],
      participants,
      today
    );
    expect(model.isFullyPaid).toBe(true);
    expect(model.fullyPaidAt).toBe("2026-07-12");
  });
});

describe("buildReceiptModel", () => {
  it("builds receipt fields from a paid installment", () => {
    const model = buildReceiptModel(
      contract,
      mkInst({
        sequence: 1,
        status: "paid",
        paidAt: "2026-07-12",
        amountCents: 5000,
      }),
      participants
    );
    expect(model.sequence).toBe(1);
    expect(model.installmentsCount).toBe(2);
    expect(model.amountCents).toBe(5000);
    expect(model.paidAt).toBe("2026-07-12");
    expect(model.parties.payerName).toBe("Comprador");
  });
});

describe("buildStatementCsv", () => {
  it("emits a semicolon-delimited statement with a header and BR values", () => {
    const model = buildStatementModel(
      contract,
      [
        mkInst({
          sequence: 1,
          amountCents: 123_456,
          status: "paid",
          paidAt: "2026-07-12",
        }),
      ],
      participants,
      today
    );
    const csv = buildStatementCsv(model);
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe("Nº;Vencimento;Valor;Status;Pago em");
    expect(lines[1]).toBe("1;10/07/2026;R$ 1.234,56;Paga;12/07/2026");
  });

  it("leaves 'Pago em' empty for unpaid rows", () => {
    const model = buildStatementModel(
      contract,
      [
        mkInst({
          sequence: 1,
          amountCents: 1000,
          status: "pending",
          paidAt: null,
        }),
      ],
      participants,
      today
    );
    const lines = buildStatementCsv(model).trim().split("\r\n");
    expect(lines[1]).toBe("1;10/07/2026;R$ 10,00;Pendente;");
  });
});

const PDF_MAGIC = "%PDF";

describe("pdf renderer", () => {
  it("renders a receipt PDF", async () => {
    const model = buildReceiptModel(
      contract,
      mkInst({
        sequence: 1,
        status: "paid",
        paidAt: "2026-07-12",
        amountCents: 5000,
      }),
      participants
    );
    const bytes = await renderReceiptPdf(model);
    expect(bytes.length).toBeGreaterThan(0);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe(PDF_MAGIC);
  });

  it("renders a statement PDF (with quittance seal when fully paid)", async () => {
    const model = buildStatementModel(
      contract,
      [
        mkInst({ sequence: 1, status: "paid", paidAt: "2026-07-01" }),
        mkInst({ sequence: 2, status: "paid", paidAt: "2026-07-12" }),
      ],
      participants,
      today
    );
    const bytes = await renderStatementPdf(model);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe(PDF_MAGIC);
  });
});

async function createContract(cookie: string, requiresConfirmation: boolean) {
  const res = await app.handle(
    new Request("http://localhost/api/contracts", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        title: "C",
        ownerRole: "buyer",
        requiresConfirmation,
        schedule: {
          mode: "auto",
          totalAmountCents: 3000,
          installmentsCount: 3,
          firstDueDate: "2026-07-10",
        },
      }),
    })
  );
  return (await res.json()).id as string;
}

async function firstInstallmentId(
  cookie: string,
  contractId: string
): Promise<string> {
  const res = await app.handle(
    new Request(`http://localhost/api/contracts/${contractId}`, {
      headers: { cookie },
    })
  );
  return (await res.json()).installments[0].id as string;
}

async function uploadProof(cookie: string, installmentId: string) {
  const presign = await (
    await app.handle(
      new Request(
        `http://localhost/api/installments/${installmentId}/proofs/presign`,
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie },
          body: JSON.stringify({
            fileName: "c.pdf",
            mimeType: "application/pdf",
          }),
        }
      )
    )
  ).json();
  await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "content-type": "application/pdf" },
    body: "%PDF-1.4 fake",
  });
  return app.handle(
    new Request(`http://localhost/api/installments/${installmentId}/proofs`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        objectKey: presign.objectKey,
        fileName: "c.pdf",
        mimeType: "application/pdf",
      }),
    })
  );
}

const hasStorage = Boolean(process.env.S3_ENDPOINT);

describe("documents endpoints", () => {
  it("requires auth", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/contracts/x/statement.csv")
    );
    expect(res.status).toBe(401);
  });

  it("statement.csv returns the header for the caller's contract", async () => {
    const cookie = await signUpCookie(uniqueEmail("doc-csv"));
    const contractId = await createContract(cookie, false);
    const res = await app.handle(
      new Request(
        `http://localhost/api/contracts/${contractId}/statement.csv`,
        {
          headers: { cookie },
        }
      )
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const body = await res.text();
    expect(body.split("\r\n")[0]).toBe("Nº;Vencimento;Valor;Status;Pago em");
  });

  it("statement.pdf returns a PDF", async () => {
    const cookie = await signUpCookie(uniqueEmail("doc-pdf"));
    const contractId = await createContract(cookie, false);
    const res = await app.handle(
      new Request(
        `http://localhost/api/contracts/${contractId}/statement.pdf`,
        {
          headers: { cookie },
        }
      )
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/pdf");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF");
  });

  it("does not leak another user's statement (404)", async () => {
    const owner = await signUpCookie(uniqueEmail("doc-owner"));
    const contractId = await createContract(owner, false);
    const other = await signUpCookie(uniqueEmail("doc-other"));
    const res = await app.handle(
      new Request(
        `http://localhost/api/contracts/${contractId}/statement.csv`,
        {
          headers: { cookie: other },
        }
      )
    );
    expect(res.status).toBe(404);
  });

  it("receipt is 409 for an unpaid installment", async () => {
    const cookie = await signUpCookie(uniqueEmail("doc-unpaid"));
    const contractId = await createContract(cookie, false);
    const instId = await firstInstallmentId(cookie, contractId);
    const res = await app.handle(
      new Request(`http://localhost/api/installments/${instId}/receipt.pdf`, {
        headers: { cookie },
      })
    );
    expect(res.status).toBe(409);
  });

  it.skipIf(!hasStorage)(
    "receipt is a PDF for a paid installment",
    async () => {
      const cookie = await signUpCookie(uniqueEmail("doc-paid"));
      const contractId = await createContract(cookie, false); // sem confirmação → upload marca paga
      const instId = await firstInstallmentId(cookie, contractId);
      await uploadProof(cookie, instId);
      const res = await app.handle(
        new Request(`http://localhost/api/installments/${instId}/receipt.pdf`, {
          headers: { cookie },
        })
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/pdf");
      expect(res.headers.get("content-disposition")).toContain("attachment");
    }
  );
});
