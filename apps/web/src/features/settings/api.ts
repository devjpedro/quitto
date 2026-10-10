import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { clearIdentityCookie } from "@/hooks/use-identity-cookie";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { changePassword, signOut } from "@/lib/auth-client";
import { queryKeys } from "@/lib/query-keys";
import type { SessionUser } from "@/lib/session-resolver";
import { m } from "@/paraglide/messages.js";
import { authErrorMessage } from "../auth/lib/auth-error";

/** PATCH /api/me { pixKey }: saves (string) or clears (null) the account's key; the Agora's guide and the receiver's codes read it. */
export function useSavePixKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pixKey: string | null) => unwrap(api.api.me.patch({ pixKey })),
    onSuccess: (me, pixKey) => {
      qc.setQueryData(queryKeys.me, (old: SessionUser | undefined) =>
        old ? { ...old, ...me } : old
      );
      qc.invalidateQueries({ queryKey: queryKeys.home });
      toast.success(pixKey ? m.settings_pix_saved() : m.settings_pix_removed());
    },
  });
}

/** PATCH /api/me { emailRemindersOptIn }, optimistic: the switch moves at once and goes back if the API fails. */
export function useEmailRemindersToggle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (optIn: boolean) =>
      unwrap(api.api.me.patch({ emailRemindersOptIn: optIn })),
    onMutate: async (optIn) => {
      await qc.cancelQueries({ queryKey: queryKeys.me });
      const previous = qc.getQueryData<SessionUser>(queryKeys.me);
      qc.setQueryData(queryKeys.me, (old: SessionUser | undefined) =>
        old ? { ...old, emailRemindersOptIn: optIn } : old
      );
      return { previous };
    },
    onError: (_error, _optIn, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(queryKeys.me, context.previous);
      }
    },
    onSuccess: (_data, optIn) => {
      toast.success(
        optIn ? m.settings_reminders_on() : m.settings_reminders_off()
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.me });
      // The guide's reminders step lives in the Agora.
      qc.invalidateQueries({ queryKey: queryKeys.home });
    },
  });
}

/** Better Auth's changePassword; a wrong current password has its own sentence, the rest goes through the auth errors. */
export function useChangePassword() {
  return useMutation({
    mutationFn: async (input: {
      currentPassword: string;
      newPassword: string;
    }) => {
      const { error } = await changePassword(input);
      if (error) {
        const code = error.code?.toUpperCase();
        throw new Error(
          code === "INVALID_PASSWORD"
            ? m.settings_password_wrong()
            : authErrorMessage(error, "signup")
        );
      }
    },
    onSuccess: () => toast.success(m.settings_password_changed()),
  });
}

/** DELETE /api/me wipes the account in cascade; then the session ends, and a full load drops every cached query. */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: () => unwrap(api.api.me.delete()),
    onSuccess: async () => {
      await signOut();
      clearIdentityCookie();
      window.location.href = "/login";
    },
  });
}

export const deletionSummaryQueryOptions = queryOptions({
  queryKey: queryKeys.deletionSummary,
  queryFn: () => unwrap(api.api.me["deletion-summary"].get()),
});

/** What deleting the account takes with it, read only when the dialog opens; a failure just leaves the sentence out. */
export function useDeletionSummary(enabled: boolean) {
  return useQuery({
    ...deletionSummaryQueryOptions,
    enabled,
    throwOnError: false,
  });
}
