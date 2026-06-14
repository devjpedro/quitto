import { describe, expect, it } from "bun:test";
import { app } from "../src/app";
import {
  computeDashboard,
  type DashboardContractInput,
} from "../src/lib/dashboard";

const today = "2026-06-13";

const inst = (
  over: Partial<DashboardContractInput["installments"][number]> = {}
) => ({
  id: "i",
  sequence: 1,
  amountCents: 1000,
  dueDate: "2026-07-10",
  status: "pending" as const,
  ...over,
});

describe("computeDashboard", () => {
  it("classifies open installments by the user's slot", () => {
    const out = computeDashboard(
      [
        {
          contractId: "c1",
          title: "Aluguel",
          userSlot: "buyer",
          status: "active",
          installments: [inst({ amountCents: 500 })],
        },
        {
          contractId: "c2",
          title: "Venda",
          userSlot: "seller",
          status: "active",
          installments: [inst({ amountCents: 700 })],
        },
      ],
      today
    );
    expect(out.toPayCents).toBe(500);
    expect(out.toReceiveCents).toBe(700);
  });

  it("excludes paid installments from the open totals", () => {
    const out = computeDashboard(
      [
        {
          contractId: "c1",
          title: "C",
          userSlot: "buyer",
          status: "active",
          installments: [inst({ status: "paid" }), inst({ amountCents: 300 })],
        },
      ],
      today
    );
    expect(out.toPayCents).toBe(300);
  });

  it("counts and sums overdue open installments", () => {
    const out = computeDashboard(
      [
        {
          contractId: "c1",
          title: "C",
          userSlot: "buyer",
          status: "active",
          installments: [inst({ amountCents: 400, dueDate: "2026-06-01" })],
        },
      ],
      today
    );
    expect(out.overdueCount).toBe(1);
    expect(out.overdueCents).toBe(400);
  });

  it("ignores viewer contracts entirely", () => {
    const out = computeDashboard(
      [
        {
          contractId: "c1",
          title: "C",
          userSlot: "viewer",
          status: "active",
          installments: [inst({ amountCents: 999, dueDate: "2026-06-01" })],
        },
      ],
      today
    );
    expect(out.toPayCents).toBe(0);
    expect(out.toReceiveCents).toBe(0);
    expect(out.overdueCount).toBe(0);
    expect(out.activeContractsCount).toBe(0);
    expect(out.upcoming).toEqual([]);
  });

  it("builds upcoming sorted by dueDate ascending (overdue, being earlier, surface first), capped at 5", () => {
    const installments = [
      inst({ id: "a", dueDate: "2026-08-10" }),
      inst({ id: "b", dueDate: "2026-06-01" }),
      inst({ id: "c", dueDate: "2026-07-01" }),
      inst({ id: "d", dueDate: "2026-09-01" }),
      inst({ id: "e", dueDate: "2026-10-01" }),
      inst({ id: "f", dueDate: "2026-11-01" }),
    ];
    const out = computeDashboard(
      [
        {
          contractId: "c1",
          title: "C",
          userSlot: "buyer",
          status: "active",
          installments,
        },
      ],
      today
    );
    expect(out.upcoming).toHaveLength(5);
    expect(out.upcoming[0]?.id).toBe("b");
    expect(out.upcoming[0]?.isOverdue).toBe(true);
    expect(out.upcoming[0]?.direction).toBe("pay");
  });

  it("counts active and completed contracts where the user is a party", () => {
    const out = computeDashboard(
      [
        {
          contractId: "c1",
          title: "A",
          userSlot: "buyer",
          status: "active",
          installments: [],
        },
        {
          contractId: "c2",
          title: "B",
          userSlot: "seller",
          status: "completed",
          installments: [],
        },
        {
          contractId: "c3",
          title: "C",
          userSlot: "viewer",
          status: "active",
          installments: [],
        },
      ],
      today
    );
    expect(out.activeContractsCount).toBe(1);
    expect(out.completedContractsCount).toBe(1);
  });
});

async function signUpCookie(tag: string): Promise<string> {
  const res = await app.handle(
    new Request("http://localhost/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "T",
        email: `${tag}-${Date.now()}@e.com`,
        password: "password123",
      }),
    })
  );
  return (res.headers.get("set-cookie") as string).split(";")[0] as string;
}

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

describe("GET /api/dashboard", () => {
  it("requires auth", async () => {
    const res = await app.handle(new Request("http://localhost/api/dashboard"));
    expect(res.status).toBe(401);
  });

  it("aggregates only the caller's contracts (buyer → a pagar)", async () => {
    const cookie = await signUpCookie("dash-buyer");
    await createContract(cookie, false); // ownerRole buyer, 3 parcelas de 1000 = 3000

    const res = await app.handle(
      new Request("http://localhost/api/dashboard", { headers: { cookie } })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.toPayCents).toBe(3000);
    expect(body.toReceiveCents).toBe(0);
    expect(body.activeContractsCount).toBe(1);
    expect(body.upcoming.length).toBeGreaterThan(0);
    expect(body.upcoming[0].direction).toBe("pay");
  });

  it("does not leak other users' contracts", async () => {
    const other = await signUpCookie("dash-other");
    await createContract(other, false);
    const mine = await signUpCookie("dash-mine");

    const res = await app.handle(
      new Request("http://localhost/api/dashboard", {
        headers: { cookie: mine },
      })
    );
    const body = await res.json();
    expect(body.toPayCents).toBe(0);
    expect(body.activeContractsCount).toBe(0);
  });
});
