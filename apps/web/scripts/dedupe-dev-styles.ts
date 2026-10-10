import type { Plugin } from "vite";

/**
 * TanStack Start's dev server inlines the CSS of the route's module graph in
 * the SSR HTML (/@tanstack-start/styles.css), one block per file under a
 * "/* <url> *\/" comment. Tailwind's own @imports (tailwindcss, tw-animate-css,
 * tokens.css) are in that graph too, with a double slash in the url
 * ("/@fs//…"), and each one is compiled as a root stylesheet: the whole
 * utility set again, AFTER src/index.css. A later ".flex" then wins over
 * "lateral:grid", and the page paints without its responsive layout until
 * the client injects the right sheet. src/index.css already inlines those
 * files, so their blocks go. Dev only: a build bundles a single sheet.
 */
const BLOCK_HEAD = /\n\/\* (\/[^\n]*?) \*\/\n/;

export function dedupeDevStyles(css: string): string {
  const [head = "", ...rest] = css.split(BLOCK_HEAD);
  let out = head;
  for (let i = 0; i < rest.length; i += 2) {
    const url = rest[i] ?? "";
    if (!url.startsWith("/@fs//")) {
      out += `\n/* ${url} */\n${rest[i + 1] ?? ""}`;
    }
  }
  return out;
}

export function dedupeDevStylesPlugin(): Plugin {
  return {
    name: "quitto:dedupe-dev-styles",
    apply: "serve",
    configureServer(server) {
      // Before TanStack Start's middleware, so the end of the response is ours.
      server.middlewares.use((req, res, next) => {
        if (!req.url?.includes("/@tanstack-start/styles.css")) {
          next();
          return;
        }
        const end = res.end.bind(res) as (chunk?: unknown) => typeof res;
        res.end = ((chunk?: unknown) =>
          end(
            typeof chunk === "string" ? dedupeDevStyles(chunk) : chunk
          )) as typeof res.end;
        next();
      });
    },
  };
}
