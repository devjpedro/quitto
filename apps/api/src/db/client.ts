import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import { account, session, user, verification } from "./schema";

export const schema = { account, session, user, verification };

const queryClient = postgres(env.DATABASE_URL);
export const db = drizzle(queryClient, { schema });
