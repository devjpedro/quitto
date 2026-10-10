import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { SessionUser } from "@/lib/session-resolver";

/** POST /api/me/app-installed: the account remembers the app was opened installed. */
export function useReportAppInstalled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.api.me["app-installed"].post()),
    onSuccess: ({ appInstalledAt }) => {
      qc.setQueryData(queryKeys.me, (old: SessionUser | undefined) =>
        old ? { ...old, appInstalledAt } : old
      );
    },
  });
}
