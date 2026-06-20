import { useSearch } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { resetPassword } from "@/lib/auth-client";
import { PAGE_TITLE } from "@/lib/page-title";

export function ResetPasswordPage() {
  useDocumentTitle(PAGE_TITLE.resetPassword);
  const search = useSearch({ strict: false }) as { token?: string };
  const token = search.token ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await resetPassword({ newPassword, token });
      if (err) {
        setError("Link inválido ou expirado. Solicite um novo.");
        return;
      }
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-sm">
        <h1 className="font-bold font-display text-2xl text-foreground tracking-tight">
          Nova senha
        </h1>
        {done ? (
          <>
            <p className="mt-3 text-muted-foreground text-sm">
              Senha redefinida com sucesso.
            </p>
            <a
              className="mt-4 block text-center text-muted-foreground text-sm underline"
              href="/login"
            >
              Ir para o login
            </a>
          </>
        ) : (
          <>
            <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
              <div className="space-y-1">
                <Label htmlFor="new-password">Nova senha</Label>
                <Input
                  id="new-password"
                  minLength={8}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  type="password"
                  value={newPassword}
                />
              </div>
              {error && (
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
              )}
              <Button className="w-full" disabled={loading} type="submit">
                {loading ? "Aguarde..." : "Redefinir senha"}
              </Button>
            </form>
            <a
              className="mt-4 block text-center text-muted-foreground text-sm underline"
              href="/login"
            >
              Voltar para o login
            </a>
          </>
        )}
      </div>
    </main>
  );
}
