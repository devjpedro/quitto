import { app } from "./app";
import { initSentry } from "./sentry";

initSentry();
app.listen(3000);
// Server startup log (ultracite's Biome preset does not enable noConsole).
console.log(`🦊 API on ${app.server?.hostname}:${app.server?.port}`);
