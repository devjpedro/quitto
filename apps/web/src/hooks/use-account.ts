import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { signOut } from "@/lib/auth-client";

/**
 * Exclui a conta do usuário (LGPD): DELETE /api/me apaga tudo em cascata no
 * backend. Em seguida encerra a sessão Better Auth e redireciona ao login —
 * window.location, não o router, para descartar qualquer estado em memória.
 */
export function useDeleteAccountMutation() {
  return useMutation({
    mutationFn: () => unwrap(api.api.me.delete()),
    onSuccess: async () => {
      await signOut();
      window.location.href = "/login";
    },
  });
}
