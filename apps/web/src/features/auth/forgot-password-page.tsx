import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { requestPasswordReset } from "@/lib/auth-client";
import { PAGE_TITLE } from "@/lib/page-title";

const RESET_PATH = "/reset-password";

export function ForgotPasswordPage() {
  useDocumentTitle(PAGE_TITLE.forgotPassword);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}${RESET_PATH}`,
      });
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-sm">
        <header className="mb-6">
          <h1 className="font-bold text-2xl text-foreground tracking-tight">
            Esqueceu a senha?
          </h1>
        </header>

        <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] sm:p-6">
          {sent ? (
            <p className="text-muted-foreground text-sm" role="status">
              Se houver uma conta com esse e-mail, enviamos um link para
              redefinir a senha. Verifique sua caixa de entrada.
            </p>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <p className="text-muted-foreground text-sm">
                Informe seu e-mail e enviaremos um link para criar uma nova
                senha.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </div>
              <Button
                className="w-full transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)] active:scale-[0.97]"
                disabled={loading}
                type="submit"
              >
                {loading ? "Aguarde..." : "Enviar link"}
              </Button>
            </form>
          )}
        </div>

        <a
          className="mt-6 block text-center text-muted-foreground text-sm underline underline-offset-2 hover:text-foreground"
          href="/login"
        >
          Voltar para o login
        </a>
      </div>
    </main>
  );
}
