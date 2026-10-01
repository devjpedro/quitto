import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { FEEDBACK } from "@/lib/feedback";
import { queryKeys } from "@/lib/query-keys";

/** PATCH /api/me { emailRemindersOptIn } com atualização otimista e rollback. */
export function useUpdateEmailRemindersMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (optIn: boolean) =>
      unwrap(api.api.me.patch({ emailRemindersOptIn: optIn })),
    onMutate: async (optIn) => {
      await qc.cancelQueries({ queryKey: queryKeys.me });
      const previous = qc.getQueryData(queryKeys.me);
      qc.setQueryData(queryKeys.me, (old: unknown) =>
        old && typeof old === "object"
          ? { ...old, emailRemindersOptIn: optIn }
          : old
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(queryKeys.me, ctx.previous);
      }
    },
    onSuccess: (_d, optIn) => {
      toast.success(
        optIn ? FEEDBACK.emailRemindersOn : FEEDBACK.emailRemindersOff
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.me }),
  });
}
