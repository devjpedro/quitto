import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

/** GET /api/people: the Pessoas list, and the wizard's suggestions (the same cache). */
export const peopleQueryOptions = queryOptions({
  queryKey: queryKeys.people,
  queryFn: () => unwrap(api.api.people.get()),
});
