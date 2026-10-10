import type { useRouter } from "@tanstack/react-router";

type AppRouter = ReturnType<typeof useRouter>;

/** history.back(), settled once the router resolved the entry under it (as navigate's promise is). */
export function goBack(router: AppRouter): Promise<void> {
  return new Promise((resolve) => {
    const stop = router.subscribe("onResolved", () => {
      stop();
      resolve();
    });
    router.history.back();
  });
}
