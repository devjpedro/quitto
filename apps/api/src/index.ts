import { app } from "./app";

app.listen(3000);
// Server startup log (ultracite's Biome preset does not enable noConsole).
console.log(`🦊 API on ${app.server?.hostname}:${app.server?.port}`);
