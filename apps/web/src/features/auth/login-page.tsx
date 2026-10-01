import { useSearch } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { AuthBrandPanel } from "@/components/auth-brand-panel";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { sendVerificationEmail, signIn, signUp } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-error-message";
import { PAGE_TITLE } from "@/lib/page-title";
import { safeRedirect } from "@/lib/safe-redirect";

const PRESS =
  "active:scale-[0.97] transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)]";

const UNVERIFIED_EMAIL_RE = /verif/i;

function submitLabel(mode: "signin" | "signup") {
  return mode === "signin" ? "Entrar" : "Criar conta";
}

export function LoginPage() {
  useDocumentTitle(PAGE_TITLE.login);
  const search = useSearch({ strict: false }) as { redirect?: string };
  // window não existe no SSR; target só é usado em handlers (client), então guardamos.
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const target = safeRedirect(search.redirect, origin);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const action =
      mode === "signin"
        ? signIn.email({ email, password, callbackURL: target })
        : signUp.email({ name, email, password, callbackURL: target });
    try {
      const { error: err } = await action;
      if (err) {
        const notVerified =
          err.code === "EMAIL_NOT_VERIFIED" ||
          UNVERIFIED_EMAIL_RE.test(err.message ?? "");
        if (mode === "signin" && notVerified) {
          setError(
            "Confirme seu e-mail antes de entrar. Reenviamos o link de verificação."
          );
          try {
            await sendVerificationEmail({
              email,
              callbackURL: target,
            });
          } catch {
            // ignore resend failure; message already shown
          }
          return;
        }
        setError(authErrorMessage(err, mode));
        return;
      }
      window.location.href = target;
    } catch {
      setError(authErrorMessage(undefined, mode));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await signIn.social({
        provider: "google",
        callbackURL: target,
      });
      if (err) {
        setError("Não foi possível continuar com o Google. Tente novamente.");
      }
    } catch {
      setError("Não foi possível continuar com o Google. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col md:flex-row">
      <AuthBrandPanel mode={mode} />

      <div className="flex flex-1 items-center justify-center bg-background px-6 py-10 md:px-10">
        <div className="w-full max-w-sm">
          <header className="mb-6">
            <h1 className="font-bold text-2xl text-foreground tracking-tight">
              {mode === "signin" ? "Entre na sua conta" : "Crie sua conta"}
            </h1>
            <p className="mt-1 text-muted-foreground text-sm">
              {mode === "signin"
                ? "Bem-vindo de volta ao Quitto."
                : "É rápido e grátis."}
            </p>
          </header>

          <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] sm:p-6">
            <Button
              className={`w-full ${PRESS}`}
              disabled={loading}
              onClick={handleGoogle}
              type="button"
              variant="outline"
            >
              Continuar com Google
            </Button>

            <div className="my-5 flex items-center gap-2 text-muted-foreground text-xs">
              <span className="h-px flex-1 bg-border" />
              ou
              <span className="h-px flex-1 bg-border" />
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    onChange={(e) => setName(e.target.value)}
                    required
                    value={name}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  aria-describedby={error ? "auth-error" : undefined}
                  aria-invalid={error ? true : undefined}
                  id="email"
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="password">Senha</Label>
                  {mode === "signin" && (
                    <a
                      className="text-muted-foreground text-xs underline underline-offset-2 hover:text-foreground"
                      href="/forgot-password"
                    >
                      Esqueci minha senha
                    </a>
                  )}
                </div>
                <PasswordInput
                  aria-describedby={error ? "auth-error" : undefined}
                  aria-invalid={error ? true : undefined}
                  id="password"
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  value={password}
                />
              </div>
              {error && (
                <p
                  className="text-destructive text-sm"
                  id="auth-error"
                  role="alert"
                >
                  {error}
                </p>
              )}
              <Button
                className={`w-full ${PRESS}`}
                disabled={loading}
                type="submit"
              >
                {loading ? "Aguarde..." : submitLabel(mode)}
              </Button>
            </form>
          </div>

          <button
            aria-label={
              mode === "signin"
                ? "Alternar para criar conta"
                : "Alternar para entrar"
            }
            className="mt-6 w-full text-center text-muted-foreground text-sm underline underline-offset-2 hover:text-foreground"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setName("");
            }}
            type="button"
          >
            {mode === "signin"
              ? "Não tem conta? Cadastre-se"
              : "Já tem conta? Entre"}
          </button>
        </div>
      </div>
    </main>
  );
}
