import { afterEach, describe, expect, it } from "vitest";
import { parseThemeCookie, THEME_COOKIE, THEME_INIT_SCRIPT } from "@/lib/theme";

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

describe("THEME_INIT_SCRIPT", () => {
  afterEach(() => {
    document.documentElement.className = "";
    // biome-ignore lint/suspicious/noDocumentCookie: jsdom test setup, resetting cookie state between cases
    document.cookie = "theme=; max-age=0";
  });

  const runScript = () => new Function(THEME_INIT_SCRIPT)();

  it("adiciona a classe dark quando o cookie é theme=dark", () => {
    // biome-ignore lint/suspicious/noDocumentCookie: jsdom test setup, simulating a cookie header
    document.cookie = "theme=dark";
    runScript();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("não adiciona a classe dark quando o cookie é theme=light", () => {
    // biome-ignore lint/suspicious/noDocumentCookie: jsdom test setup, simulating a cookie header
    document.cookie = "theme=light";
    runScript();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("não adiciona a classe dark para um valor de cookie inválido (regressão do regex sem âncora final)", () => {
    // biome-ignore lint/suspicious/noDocumentCookie: jsdom test setup, simulating a cookie header
    document.cookie = "theme=darkness";
    runScript();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
