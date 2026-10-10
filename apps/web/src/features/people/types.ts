import type { api } from "@/lib/api";

type PeopleResponse = Awaited<ReturnType<typeof api.api.people.get>>;

/** GET /api/people: one row per counterpart, with the balance and the contracts with them. */
export type Person = NonNullable<PeopleResponse["data"]>["people"][number];
export type PersonContract = Person["contracts"][number];
