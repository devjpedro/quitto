import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { SessionUser } from "@/lib/session-resolver";

/**
 * PATCH /api/me { tourCompleted }: true when the tour is finished or skipped
 * (it never opens by itself again), false for "Refazer" in Ajustes. The
 * cache follows at once, so the first-visit check does not fire twice.
 */
export function useSetTourCompleted() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (completed: boolean) =>
      unwrap(api.api.me.patch({ tourCompleted: completed })),
    onMutate: (completed) => {
      qc.setQueryData(queryKeys.me, (old: SessionUser | undefined) =>
        old
          ? {
              ...old,
              tourCompletedAt: completed ? new Date().toISOString() : null,
            }
          : old
      );
    },
    onSuccess: (me) => {
      qc.setQueryData(queryKeys.me, (old: SessionUser | undefined) =>
        old ? { ...old, tourCompletedAt: me.tourCompletedAt } : old
      );
    },
  });
}
