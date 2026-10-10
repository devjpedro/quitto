import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { user } from "../src/db/schema";
import {
  localeFromHeaders,
  localeOfEmail,
  pickLocale,
  userLocale,
} from "../src/lib/locale";
import { signUpCookie, uniqueEmail } from "./helpers/auth";

const h = (init: Record<string, string>) => new Headers(init);

describe("localeFromHeaders", () => {
  it("o cookie locale vale mais que o Accept-Language", () => {
    expect(
      localeFromHeaders(
        h({ "accept-language": "pt-BR", cookie: "a=1; locale=en-US" })
      )
    ).toBe("en-US");
  });

  it("Accept-Language: o primeiro idioma suportado pela ordem de q", () => {
    expect(
      localeFromHeaders(
        h({ "accept-language": "fr;q=1, en;q=0.9, pt-BR;q=0.8" })
      )
    ).toBe("en-US");
    expect(localeFromHeaders(h({ "accept-language": "pt-PT" }))).toBe("pt-BR");
  });

  it("cookie inválido e idioma sem suporte: null", () => {
    expect(
      localeFromHeaders(h({ "accept-language": "fr, de", cookie: "locale=es" }))
    ).toBeNull();
    expect(localeFromHeaders(undefined)).toBeNull();
    expect(localeFromHeaders(h({}))).toBeNull();
  });
});

describe("pickLocale", () => {
  it("pickLocale: o primeiro válido, senão pt-BR", () => {
    expect(pickLocale(null, "es", undefined, "en-US")).toBe("en-US");
    expect(pickLocale()).toBe("pt-BR");
    expect(pickLocale(null, "xx")).toBe("pt-BR");
  });
});

describe("userLocale e localeOfEmail", () => {
  it("leem a conta; e-mail sem diferenciar maiúsculas; sem conta, null", async () => {
    const email = uniqueEmail("locale");
    await signUpCookie(email);
    const [row] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email));
    const id = row?.id ?? "";
    expect(await userLocale(id)).toBeNull();
    await db.update(user).set({ locale: "en-US" }).where(eq(user.id, id));
    expect(await userLocale(id)).toBe("en-US");
    expect(await localeOfEmail(email.toUpperCase())).toBe("en-US");
    expect(await localeOfEmail("ninguem@example.com")).toBeNull();
    expect(await userLocale("nao-existe")).toBeNull();
  });
});
