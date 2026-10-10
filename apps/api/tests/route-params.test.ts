import { describe, expect, it } from "bun:test";
import { app } from "../src/app";
import { signUpCookie, uniqueEmail } from "./helpers/auth";

/** A well-formed id that matches nothing. */
const NONE = "11111111-1111-4111-8111-111111111111";
const BAD = "abc";
/** What a failed query leaves in a 500's body. */
const SQL = /select|failed query/i;

function call(cookie: string, path: string, method = "GET", body?: unknown) {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers: { "content-type": "application/json", cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  );
}

/**
 * Every route with an id in the path (all uuid columns), each with a body the
 * route accepts, so only the id is wrong; a second id goes under the user's
 * own contract, so the first one does not answer for it. A cut link (/contracts/abc, a
 * WhatsApp ?installment=abc) used to reach Postgres, fail on the cast (22P02)
 * and answer 500 with the failed query in the body.
 */
const routes = (
  cid: string
): [method: string, path: string, body?: unknown][] => [
  ["GET", `/api/contracts/${BAD}`],
  ["PATCH", `/api/contracts/${BAD}`, { title: "Moto" }],
  ["DELETE", `/api/contracts/${BAD}`],
  ["DELETE", `/api/contracts/${BAD}/me`],
  ["GET", `/api/contracts/${BAD}/events`],
  ["GET", `/api/contracts/${BAD}/statement.pdf`],
  ["GET", `/api/contracts/${BAD}/statement.csv`],
  ["PATCH", `/api/contracts/${BAD}/installments/${NONE}`, { amountCents: 500 }],
  ["PATCH", `/api/contracts/${cid}/installments/${BAD}`, { amountCents: 500 }],
  [
    "POST",
    `/api/contracts/${BAD}/participants`,
    { displayName: "Rafael", role: "buyer" },
  ],
  ["DELETE", `/api/contracts/${cid}/participants/${BAD}`],
  [
    "POST",
    `/api/contracts/${cid}/participants/${BAD}/invite`,
    { email: "rafa@exemplo.com" },
  ],
  [
    "POST",
    `/api/contracts/${cid}/participants/${BAD}/invite/resend`,
    { email: "rafa@exemplo.com" },
  ],
  [
    "PATCH",
    `/api/contracts/${cid}/participants/${BAD}/pix-key`,
    { pixKey: "rafa@exemplo.com" },
  ],
  ["GET", `/api/installments/${BAD}`],
  ["GET", `/api/installments/${BAD}/receipt.pdf`],
  ["GET", `/api/installments/${BAD}/receipt-share`],
  ["POST", `/api/installments/${BAD}/receipt-share`],
  ["DELETE", `/api/installments/${BAD}/receipt-share`],
  [
    "POST",
    `/api/installments/${BAD}/proofs/presign`,
    { fileName: "pix.pdf", mimeType: "application/pdf" },
  ],
  [
    "POST",
    `/api/installments/${BAD}/proofs`,
    {
      objectKey: "proofs/x/pix.pdf",
      fileName: "pix.pdf",
      mimeType: "application/pdf",
    },
  ],
  ["POST", `/api/installments/${BAD}/confirm`],
  ["POST", `/api/installments/${BAD}/dispute`, { reason: "Veio a menos." }],
  ["POST", `/api/installments/${BAD}/mark-paid`],
  ["POST", `/api/installments/${BAD}/mark-received`],
  ["POST", `/api/notifications/${BAD}/read`],
];

describe("ids na URL (revisão final api M1)", () => {
  it("id que não é uuid: 404 'não encontrado' no envelope da API, sem o SQL no corpo, em toda rota com id", async () => {
    const cookie = await signUpCookie(uniqueEmail("route-params"));
    const created = await call(cookie, "/api/contracts", "POST", {
      title: "Moto do Rafa",
      ownerRole: "seller",
      requiresConfirmation: true,
      schedule: {
        mode: "auto",
        totalAmountCents: 96_000,
        installmentsCount: 2,
        firstDueDate: "2026-08-30",
      },
    });
    const { id } = (await created.json()) as { id: string };
    const wrong: string[] = [];
    for (const [method, path, body] of routes(id)) {
      const res = await call(cookie, path, method, body);
      const text = await res.text();
      const leaksSql = SQL.test(text);
      const notFound =
        res.status === 404 &&
        (JSON.parse(text) as { error?: { code?: string } }).error?.code ===
          "NOT_FOUND";
      if (leaksSql || !notFound) {
        wrong.push(
          `${method} ${path} → ${res.status}${leaksSql ? " (com o SQL)" : ""}`
        );
      }
    }
    expect(wrong).toEqual([]);
  });

  it("sem sessão, o id malformado continua 401: a sessão vem antes do id", async () => {
    for (const path of [
      `/api/contracts/${BAD}`,
      `/api/contracts/${BAD}/statement.csv`,
      `/api/installments/${BAD}`,
    ]) {
      const res = await call("", path);
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({
        error: { code: "UNAUTHORIZED" },
      });
    }
  });

  it("o corpo inválido continua 422 (só o id da URL vira 'não encontrado')", async () => {
    const cookie = await signUpCookie(uniqueEmail("route-params-body"));
    const res = await call(cookie, `/api/contracts/${NONE}`, "PATCH", {
      title: 42,
    });
    expect(res.status).toBe(422);
  });
});
