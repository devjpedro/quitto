import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import { account, session, user, verification } from "./schema";

export const schema = { account, session, user, verification };

// No statement_timeout here: prod goes through Neon's PgBouncer pooler, which may
// refuse startup parameters (the timeout is an ALTER ROLE on Neon).
const queryClient = postgres(env.DATABASE_URL, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
});
export const db = drizzle(queryClient, { schema });
