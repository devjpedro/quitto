import type { CompilerOptions } from "@inlang/paraglide-js";

// Single source of truth for the Paraglide compiler. The Vite plugin
// (vite.config.ts, vitest.config.ts) and the standalone compile that
// `typecheck` runs (scripts/compile-i18n.ts) all write to the same outdir, so
// they must compile with identical options. The paraglide-js CLI cannot set
// `cookieName`, which is why the standalone compile calls compile() directly.
export const paraglideOptions = {
  project: "./project.inlang",
  outdir: "./src/paraglide",
  outputStructure: "message-modules",
  cookieName: "locale",
  strategy: ["cookie", "preferredLanguage", "baseLocale"],
} satisfies CompilerOptions;
