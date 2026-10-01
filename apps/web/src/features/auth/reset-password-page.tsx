import { useSearch } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
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
        <header className="mb-6">
          <h1 className="font-bold text-2xl text-foreground tracking-tight">
            Nova senha
          </h1>
        </header>

        <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] sm:p-6">
          {done ? (
            <p className="text-muted-foreground text-sm" role="status">
              Senha redefinida com sucesso.
            </p>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">Nova senha</Label>
                <PasswordInput
                  id="new-password"
                  minLength={8}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  value={newPassword}
                />
              </div>
              {error && (
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
              )}
              <Button
                className="w-full transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)] active:scale-[0.97]"
                disabled={loading}
                type="submit"
              >
                {loading ? "Aguarde..." : "Redefinir senha"}
              </Button>
            </form>
          )}
        </div>

        <a
          className="mt-6 block text-center text-muted-foreground text-sm underline underline-offset-2 hover:text-foreground"
          href="/login"
        >
          {done ? "Ir para o login" : "Voltar para o login"}
        </a>
      </div>
    </main>
  );
}
