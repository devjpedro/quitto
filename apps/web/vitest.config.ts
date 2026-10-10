import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { paraglideOptions } from "./paraglide.config";

export default defineConfig({
  plugins: [
    paraglideVitePlugin(paraglideOptions),
    react(),
  ],
  resolve: { alias: { "@": resolve(__dirname, "./src") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    css: false,
  },
});
