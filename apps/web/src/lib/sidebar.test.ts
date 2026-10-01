import { describe, expect, it } from "vitest";
import { parseSidebarCookie, SIDEBAR_COOKIE } from "@/lib/sidebar";

describe("parseSidebarCookie", () => {
  it("lê collapsed", () =>
    expect(parseSidebarCookie("sidebar=collapsed")).toBe("collapsed"));
  it("lê expanded", () =>
    expect(parseSidebarCookie("a=1; sidebar=expanded; b=2")).toBe("expanded"));
  it("ignora valor inválido", () =>
    expect(parseSidebarCookie("sidebar=roxo")).toBeUndefined());
  it("undefined sem cookie", () => {
    expect(parseSidebarCookie(null)).toBeUndefined();
    expect(parseSidebarCookie("")).toBeUndefined();
    expect(parseSidebarCookie("outro=1")).toBeUndefined();
  });
  it("expõe o nome do cookie", () => expect(SIDEBAR_COOKIE).toBe("sidebar"));
});
