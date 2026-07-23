import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

/** PATCH /api/me — salva (string) ou limpa (null) a chave PIX do perfil. */
export function useUpdatePixKeyMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pixKey: string | null) => unwrap(api.api.me.patch({ pixKey })),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.me }),
  });
}
