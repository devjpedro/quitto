import { defineCustomClientStrategy, isLocale } from "@/paraglide/runtime.js";

/**
 * The browser hydrates in the language the server rendered. With no cookie the
 * server reads Accept-Language and the browser reads navigator.languages; when
 * they disagree (a crawler, a headless browser) the first render differs from
 * the HTML, and React throws the server's DOM away and draws it again. The
 * server's choice is on <html lang> (the root route writes it).
 */
if (typeof document !== "undefined") {
  defineCustomClientStrategy("custom-ssr", {
    getLocale: () => {
      const lang = document.documentElement.lang;
      return isLocale(lang) ? lang : undefined;
    },
    // A new locale is saved by the cookie strategy, and the reload rewrites <html lang>.
    setLocale: () => undefined,
  });
}
