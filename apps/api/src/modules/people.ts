import { todayISO } from "@quitto/shared";
import { Elysia } from "elysia";
import { loadContractRows } from "../lib/contract-rows";
import { groupPeople } from "../lib/people";
import { requireAuth } from "../lib/session";
import { peopleSchema } from "./list-schemas";

/** The other side of the caller's contracts, one entry per person; everything is read through the caller's visible contracts. */
export const peopleModule = new Elysia({ prefix: "/api" }).get(
  "/people",
  async ({ request }) => {
    const { user } = await requireAuth(request.headers);
    const rows = await loadContractRows(user.id);
    return {
      people: groupPeople(
        { id: user.id, email: user.email },
        rows,
        todayISO(),
        new Date()
      ),
    };
  },
  { response: peopleSchema }
);
