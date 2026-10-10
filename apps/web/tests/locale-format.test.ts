import { afterEach, describe, expect, it, vi } from "vitest";
import {
  daysBetween,
  formatDate,
  formatMoney,
  formatMonthName,
  formatRelativeDays,
  formatRelativeTime,
  moneyParts,
  normalizeSpaces,
} from "@/lib/locale-format";
import { importInZone, ZONES } from "./time-zones";

const NBSP_RE = /[\u00A0\u202F]/;

describe("formatMoney", () => {
  it("formats BRL in both locales", () => {
    expect(formatMoney(125_000, "pt-BR")).toBe("R$ 1.250,00");
    expect(formatMoney(125_000, "en-US")).toBe("R$1,250.00");
  });

  it("handles zero and negatives", () => {
    expect(formatMoney(0, "pt-BR")).toBe("R$ 0,00");
    expect(formatMoney(-50_000, "pt-BR")).toBe("-R$ 500,00");
  });

  it("never renders a negative zero", () => {
    // e.g. negating a zero balance gives -0, which Intl prints as "-R$ 0,00".
    expect(formatMoney(-0, "pt-BR")).toBe("R$ 0,00");
    expect(formatMoney(-0, "en-US")).toBe("R$0.00");
  });

  it("normalizes non-breaking spaces to regular spaces", () => {
    const result = formatMoney(125_000, "pt-BR");
    // Ensure no U+00A0 (non-breaking space) or U+202F (narrow no-break space) remain
    expect(result).not.toMatch(NBSP_RE);
    expect(result).toBe("R$ 1.250,00");
  });
});

describe("normalizeSpaces", () => {
  it("turns NBSP and narrow NBSP into plain spaces", () => {
    const nbsp = String.fromCharCode(0x00_a0);
    const narrow = String.fromCharCode(0x20_2f);
    expect(normalizeSpaces(`R$${nbsp}1${narrow}2`)).toBe("R$ 1 2");
  });

  it("leaves other text untouched", () => {
    expect(normalizeSpaces("R$ 1.250,00")).toBe("R$ 1.250,00");
  });
});

describe("moneyParts", () => {
  it("splits pt-BR into currency, integer, decimal and fraction", () => {
    expect(moneyParts(125_050, "pt-BR")).toEqual({
      sign: "",
      currency: "R$",
      integer: "1.250",
      decimal: ",",
      fraction: "50",
    });
  });

  it("uses en-US separators", () => {
    expect(moneyParts(125_050, "en-US")).toMatchObject({
      integer: "1,250",
      decimal: ".",
      fraction: "50",
    });
  });

  it("keeps the sign for negative values", () => {
    expect(moneyParts(-900, "pt-BR")).toMatchObject({
      sign: "-",
      integer: "9",
      fraction: "00",
    });
  });

  it("drops the sign of a negative zero", () => {
    expect(moneyParts(-0, "pt-BR").sign).toBe("");
    expect(moneyParts(-0, "pt-BR")).toMatchObject({
      integer: "0",
      fraction: "00",
    });
  });
});

describe("formatDate", () => {
  it("formats short dates without timezone drift", () => {
    expect(formatDate("2026-10-02", "pt-BR", "short")).toBe("02/10/2026");
    expect(formatDate("2026-10-02", "en-US", "short")).toBe("10/02/2026");
  });

  it("formats medium dates with the month name", () => {
    expect(formatDate("2026-10-02", "pt-BR", "medium")).toContain("out");
    expect(formatDate("2026-10-02", "en-US", "medium")).toContain("Oct");
  });
});

describe("relative days", () => {
  it("counts calendar days", () => {
    expect(daysBetween("2026-10-01", "2026-10-02")).toBe(1);
    expect(daysBetween("2026-10-01", "2026-09-27")).toBe(-4);
    expect(daysBetween("2026-02-28", "2026-03-01")).toBe(1);
  });

  it("speaks naturally in each locale", () => {
    expect(formatRelativeDays("2026-10-01", "2026-10-01", "pt-BR")).toBe(
      "hoje"
    );
    expect(formatRelativeDays("2026-10-02", "2026-10-01", "pt-BR")).toBe(
      "amanhã"
    );
    expect(formatRelativeDays("2026-09-27", "2026-10-01", "pt-BR")).toBe(
      "há 4 dias"
    );
    expect(formatRelativeDays("2026-10-02", "2026-10-01", "en-US")).toBe(
      "tomorrow"
    );
    expect(formatRelativeDays("2026-09-27", "2026-10-01", "en-US")).toBe(
      "4 days ago"
    );
  });
});

describe("formatDate: presets curtos", () => {
  it("dia e mês sem ano", () => {
    expect(formatDate("2026-10-03", "pt-BR", "dayMonth")).toBe("03/10");
    expect(formatDate("2026-10-03", "en-US", "dayMonth")).toBe("10/03");
  });

  it("dia da semana abreviado + dia e mês", () => {
    expect(formatDate("2026-10-03", "pt-BR", "weekdayShort")).toBe(
      "sáb., 03/10"
    );
    expect(formatDate("2026-10-03", "en-US", "weekdayShort")).toBe(
      "Sat, 10/03"
    );
  });
});

describe("formatRelativeTime", () => {
  const now = Date.parse("2026-10-02T12:00:00Z");

  it("horas, ontem e dias atrás", () => {
    expect(formatRelativeTime("2026-10-02T10:00:00Z", now, "pt-BR")).toBe(
      "há 2 h"
    );
    expect(formatRelativeTime("2026-10-01T12:00:00Z", now, "pt-BR")).toBe(
      "ontem"
    );
    expect(formatRelativeTime("2026-09-29T12:00:00Z", now, "pt-BR")).toBe(
      "há 3 dias"
    );
    expect(formatRelativeTime("2026-10-02T12:00:00Z", now, "pt-BR")).toBe(
      "agora"
    );
  });

  it("um aviso que chega com o relógio do cliente atrasado é 'agora', nunca 'em 5 s'", () => {
    expect(formatRelativeTime("2026-10-02T12:00:05Z", now, "pt-BR")).toBe(
      "agora"
    );
  });

  it("no idioma pedido", () => {
    expect(formatRelativeTime("2026-10-02T10:00:00Z", now, "en-US")).toBe(
      "2 hr. ago"
    );
    expect(formatRelativeTime("2026-10-01T12:00:00Z", now, "en-US")).toBe(
      "yesterday"
    );
  });

  // São Paulo is UTC-3: 2026-10-03T02:00Z is 23:00 of Oct 2 there.
  it("46 h atrás, mas ainda ontem no calendário de São Paulo, é 'ontem'", () => {
    const lateTonight = Date.parse("2026-10-03T02:00:00Z");
    const yesterdayAt1am = "2026-10-01T04:00:00Z";
    expect(formatRelativeTime(yesterdayAt1am, lateTonight, "pt-BR")).toBe(
      "ontem"
    );
    expect(formatRelativeTime(yesterdayAt1am, lateTonight, "en-US")).toBe(
      "yesterday"
    );
  });

  it("26 h atrás, cruzando duas meias-noites de São Paulo, é 'anteontem'", () => {
    const earlyToday = Date.parse("2026-10-02T04:00:00Z");
    const twoDaysAgoAt11pm = "2026-10-01T02:00:00Z";
    expect(formatRelativeTime(twoDaysAgoAt11pm, earlyToday, "pt-BR")).toBe(
      "anteontem"
    );
    expect(formatRelativeTime(twoDaysAgoAt11pm, earlyToday, "en-US")).toBe(
      "2 days ago"
    );
  });

  it("nunca chega ao valor da unidade seguinte ('há 60 min', 'há 24 h')", () => {
    const ago = (seconds: number) =>
      new Date(now - seconds * 1000).toISOString();
    expect(formatRelativeTime(ago(59.6), now, "pt-BR")).toBe("há 59 seg.");
    expect(formatRelativeTime(ago(59 * 60 + 40), now, "pt-BR")).toBe(
      "há 59 min."
    );
    expect(formatRelativeTime(ago(23 * 3600 + 59 * 60), now, "pt-BR")).toBe(
      "há 23 h"
    );
    expect(formatRelativeTime(ago(6.5 * 86_400), now, "pt-BR")).toBe(
      "há 1 semana"
    );
  });

  // Weeks, months and years are elapsed blocks, not calendar periods: they
  // never use "semana passada" / "mês passado" / "ano passado". Amounts are
  // truncated, with a month of 30.44 days (2_629_800 s).
  it("semana, mês e ano dizem tempo decorrido, nunca 'semana/mês/ano passado'", () => {
    // 13 days (Sat Sep 19, two calendar weeks back): trunc(1.86 wk) = 1.
    expect(formatRelativeTime("2026-09-19T12:00:00Z", now, "pt-BR")).toBe(
      "há 1 semana"
    );
    expect(formatRelativeTime("2026-09-19T12:00:00Z", now, "en-US")).toBe(
      "1 week ago"
    );
    // Aug 5 read on Oct 2 is 58 days: trunc(1.91 mo) = 1, so "há 1 mês".
    expect(formatRelativeTime("2026-08-05T12:00:00Z", now, "pt-BR")).toBe(
      "há 1 mês"
    );
    expect(formatRelativeTime("2026-08-05T12:00:00Z", now, "en-US")).toBe(
      "1 month ago"
    );
    // November 2024 is 699 days: trunc(1.91 yr) = 1.
    expect(formatRelativeTime("2024-11-02T12:00:00Z", now, "pt-BR")).toBe(
      "há 1 ano"
    );
    expect(formatRelativeTime("2024-11-02T12:00:00Z", now, "en-US")).toBe(
      "1 year ago"
    );
  });

  // Mockup 10 writes weeks, months and years in full ("há 1 semana"); the
  // smaller units stay short ("há 2 h", "2 hr. ago").
  it("semana, mês e ano por extenso; horas e minutos curtos", () => {
    // Sep 12 read on Oct 2 is 20 days: trunc(2.86 wk) = 2.
    expect(formatRelativeTime("2026-09-12T12:00:00Z", now, "pt-BR")).toBe(
      "há 2 semanas"
    );
    expect(formatRelativeTime("2026-09-12T12:00:00Z", now, "en-US")).toBe(
      "2 weeks ago"
    );
    // Jun 2 read on Oct 2 is 122 days: trunc(4.01 mo) = 4.
    expect(formatRelativeTime("2026-06-02T12:00:00Z", now, "pt-BR")).toBe(
      "há 4 meses"
    );
    expect(formatRelativeTime("2026-10-02T11:30:00Z", now, "pt-BR")).toBe(
      "há 30 min."
    );
    expect(formatRelativeTime("2026-10-02T11:30:00Z", now, "en-US")).toBe(
      "30 min. ago"
    );
  });
});

describe("datas no fuso da máquina", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const load = () => import("@/lib/locale-format");

  it.each(ZONES)("nenhuma data muda de dia pelo fuso (%s)", async (zone) => {
    const lf = await importInZone(zone, load);
    expect(lf.formatDate("2026-10-02", "pt-BR", "short")).toBe("02/10/2026");
    expect(lf.formatDate("2026-11-01", "en-US", "dayMonth")).toBe("11/01");
    expect(lf.formatDate("2026-10-03", "pt-BR", "weekdayShort")).toBe(
      "sáb., 03/10"
    );
    expect(lf.formatMonthName("2026-11", "pt-BR")).toBe("novembro");
    expect(lf.daysBetween("2026-10-31", "2026-11-01")).toBe(1);
    expect(lf.formatRelativeDays("2026-10-02", "2026-10-01", "pt-BR")).toBe(
      "amanhã"
    );
  });

  // São Paulo is UTC-3: 2026-10-03T02:00Z is 23:00 of Oct 2 there, and
  // already 11:00 of Oct 3 in Tokyo, where the same pair is two days apart.
  it.each(ZONES)(
    "'ontem' e 'anteontem' seguem o calendário de São Paulo, nunca o da máquina (%s)",
    async (zone) => {
      const lf = await importInZone(zone, load);
      const lateTonight = Date.parse("2026-10-03T02:00:00Z");
      expect(
        lf.formatRelativeTime("2026-10-01T04:00:00Z", lateTonight, "pt-BR")
      ).toBe("ontem");
      const earlyToday = Date.parse("2026-10-02T04:00:00Z");
      expect(
        lf.formatRelativeTime("2026-10-01T02:00:00Z", earlyToday, "pt-BR")
      ).toBe("anteontem");
    }
  );
});

describe("formatMonthName", () => {
  it("nome do mês por idioma", () => {
    expect(formatMonthName("2026-09", "pt-BR")).toBe("setembro");
    expect(formatMonthName("2026-09", "en-US")).toBe("September");
  });
});

describe("formatadores em cache", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // The first call (before the spy) creates the formatter for real: a
  // formatter built under vi.spyOn lacks the Intl prototype in vitest 4.
  it("não cria outro Intl.DateTimeFormat para o mesmo idioma e preset", () => {
    formatDate("2026-10-02", "en-US", "medium");
    const spy = vi.spyOn(Intl, "DateTimeFormat");
    formatDate("2026-10-03", "en-US", "medium");
    formatDate("2026-10-04", "en-US", "medium");
    formatDate("2026-10-05", "en-US", "medium");
    expect(spy).toHaveBeenCalledTimes(0);
  });

  it("não cria outro Intl.RelativeTimeFormat para o mesmo idioma (dias)", () => {
    formatRelativeDays("2026-10-02", "2026-10-02", "en-US");
    const spy = vi.spyOn(Intl, "RelativeTimeFormat");
    formatRelativeDays("2026-10-03", "2026-10-02", "en-US");
    formatRelativeDays("2026-10-04", "2026-10-02", "en-US");
    expect(spy).toHaveBeenCalledTimes(0);
  });

  it("não cria outro Intl.DateTimeFormat para o nome do mês no mesmo idioma", () => {
    formatMonthName("2026-09", "en-US");
    const spy = vi.spyOn(Intl, "DateTimeFormat");
    formatMonthName("2026-10", "en-US");
    formatMonthName("2026-11", "en-US");
    expect(spy).toHaveBeenCalledTimes(0);
  });

  it("não cria outro Intl.RelativeTimeFormat a cada aviso da lista (tempo relativo)", () => {
    const now = Date.parse("2026-10-02T12:00:00Z");
    // Warms both formatters: hours read as elapsed time, days as calendar words.
    formatRelativeTime("2026-10-02T10:00:00Z", now, "en-US");
    formatRelativeTime("2026-10-01T12:00:00Z", now, "en-US");
    const spy = vi.spyOn(Intl, "RelativeTimeFormat");
    formatRelativeTime("2026-10-02T11:00:00Z", now, "en-US");
    formatRelativeTime("2026-09-30T12:00:00Z", now, "en-US");
    formatRelativeTime("2026-08-05T12:00:00Z", now, "en-US");
    expect(spy).toHaveBeenCalledTimes(0);
  });
});
