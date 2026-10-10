import { getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback } from "react";
import { goBack } from "@/lib/history-back";

const route = getRouteApi("/_app/people");

/**
 * The person open in the sheet, in the URL. Opening pushes an entry marked
 * `panel` (the phone's Back closes the sheet and stays on the list); closing
 * that entry goes back to the one under it, otherwise (a link) it replaces.
 */
export function usePeopleRoute() {
  const { person } = route.useSearch();
  const navigate = useNavigate({ from: "/people" });
  const router = useRouter();
  const open = useCallback(
    (key: string) =>
      navigate({
        search: { person: key },
        ...(person
          ? { replace: true, state: true as const }
          : { state: { panel: true } }),
        resetScroll: false,
      }),
    [navigate, person]
  );
  const close = useCallback(() => {
    if (router.state.location.state.panel === true) {
      return goBack(router);
    }
    return navigate({
      search: { person: undefined },
      replace: true,
      resetScroll: false,
    });
  }, [navigate, router]);
  return { close, open, person: person ?? null };
}
