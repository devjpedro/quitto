import { t } from "elysia";

/**
 * An id in the path: every one is a uuid column. Anything else never reaches
 * Postgres (a failed cast there was a 500 with the query in the body); the
 * app answers it as "not found" (app.ts).
 */
export const idParam = t.String({ format: "uuid" });
