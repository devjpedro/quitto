import { app } from "./app";
import { initSentry } from "./sentry";

initSentry();
// 1 MB: the proof upload goes straight to the bucket, never through the API.
app.listen({ port: 3000, maxRequestBodySize: 1024 * 1024 });
// Server startup log (ultracite's Biome preset does not enable noConsole).
console.log(`🦊 API on ${app.server?.hostname}:${app.server?.port}`);
