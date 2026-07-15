import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { parseThemeCookie, type Theme } from "@/lib/theme";

/** Lê o cookie `theme` da request no SSR (undefined = 1ª visita → cliente resolve). */
export const getThemeSSR = createServerFn({ method: "GET" }).handler(
  (): Theme | undefined => {
    const cookie = getRequest().headers.get("cookie");
    return parseThemeCookie(cookie);
  }
);
