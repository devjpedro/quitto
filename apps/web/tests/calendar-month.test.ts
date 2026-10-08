import { describe, expect, it } from "vitest";
import {
  calendarMonth,
  defaultDay,
  markOf,
} from "@/features/installments/lib/calendar-month";
import { listInstallment } from "./installments-fixtures";

const TODAY = "2026-10-08";

describe("calendarMonth", () => {
  it("outubro de 2026 começa na quinta: 5 linhas; maio de 2027: 6 linhas", () => {
    const october = calendarMonth("2026-10", [], TODAY);
    expect(october).toHaveLength(5);
    expect(october[0]?.[4]?.iso).toBe("2026-10-01");
    expect(october[0]?.[0]?.iso).toBe("2026-09-27");
    expect(october.at(-1)?.at(-1)?.iso).toBe("2026-10-31");
    expect(calendarMonth("2027-05", [], TODAY)).toHaveLength(6);
  });

  it("os dias de fora do mês não têm parcelas", () => {
    const grid = calendarMonth(
      "2026-10",
      [listInstallment({ dueDate: "2026-09-29" })],
      TODAY
    );
    const outside = grid.flat().filter((day) => !day.inMonth);
    expect(outside).toHaveLength(4);
    expect(outside.every((day) => day.items.length === 0)).toBe(true);
  });

  it("a atrasada de setembro não entra na grade de outubro", () => {
    const grid = calendarMonth(
      "2026-10",
      [
        listInstallment({ dueDate: "2026-09-05" }),
        listInstallment({ dueDate: "2026-10-05" }),
      ],
      TODAY
    );
    expect(grid.flat().flatMap((day) => day.items)).toHaveLength(1);
  });

  it("marca hoje e põe as parcelas no próprio dia", () => {
    const grid = calendarMonth(
      "2026-10",
      [
        listInstallment({ dueDate: TODAY }),
        listInstallment({ dueDate: TODAY }),
      ],
      TODAY
    );
    const today = grid.flat().find((day) => day.isToday);
    expect(today?.iso).toBe(TODAY);
    expect(today?.items).toHaveLength(2);
  });
});

describe("defaultDay", () => {
  it("hoje, senão o primeiro com parcela, senão o dia 1", () => {
    expect(defaultDay("2026-10", TODAY, [])).toBe(TODAY);
    const items = [
      listInstallment({ dueDate: "2026-11-20" }),
      listInstallment({ dueDate: "2026-11-09" }),
    ];
    expect(defaultDay("2026-11", TODAY, items)).toBe("2026-11-09");
    expect(defaultDay("2026-12", TODAY, items)).toBe("2026-12-01");
  });
});

describe("markOf", () => {
  it("segue os estados da barra", () => {
    expect(markOf(listInstallment({ status: "paid" }), TODAY)).toBe("paid");
    expect(
      markOf(
        listInstallment({
          status: "awaiting_confirmation",
          dueDate: "2026-10-01",
        }),
        TODAY
      )
    ).toBe("review");
    expect(markOf(listInstallment({ dueDate: "2026-10-01" }), TODAY)).toBe(
      "overdue"
    );
    expect(markOf(listInstallment({ dueDate: TODAY }), TODAY)).toBe("today");
    expect(markOf(listInstallment({ dueDate: "2026-10-20" }), TODAY)).toBe(
      "open"
    );
  });
});
