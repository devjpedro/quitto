import { describe, expect, it } from "vitest";
import { parseThemeCookie, THEME_COOKIE } from "@/lib/theme";

describe("parseThemeCookie", () => {
  it("lê dark", () => expect(parseThemeCookie("theme=dark")).toBe("dark"));
  it("lê light", () =>
    expect(parseThemeCookie("a=1; theme=light; b=2")).toBe("light"));
  it("ignora valor inválido", () =>
    expect(parseThemeCookie("theme=roxo")).toBeUndefined());
  it("undefined sem cookie", () => {
    expect(parseThemeCookie(null)).toBeUndefined();
    expect(parseThemeCookie("")).toBeUndefined();
    expect(parseThemeCookie("outro=1")).toBeUndefined();
  });
  it("expõe o nome do cookie", () => expect(THEME_COOKIE).toBe("theme"));
});
