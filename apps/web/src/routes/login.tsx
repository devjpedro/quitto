import { useSearch } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { AuthBrandPanel } from "@/components/auth-brand-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { sendVerificationEmail, signIn, signUp } from "@/lib/auth-client";
import { PAGE_TITLE } from "@/lib/page-title";
import { safeRedirect } from "@/lib/safe-redirect";

const UNVERIFIED_EMAIL_RE = /verif/i;

function submitLabel(mode: "signin" | "signup") {
  return mode === "signin" ? "Entrar" : "Criar conta";
}

export function LoginPage() {
  useDocumentTitle(PAGE_TITLE.login);
  const search = useSearch({ strict: false }) as { redirect?: string };
  const target = safeRedirect(search.redirect, window.location.origin);
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
    const failMessage =
      mode === "signin"
        ? "Não foi possível entrar. Verifique os dados e tente novamente."
        : "Não foi possível criar a conta. Verifique os dados e tente novamente.";
    const action =
      mode === "signin"
        ? signIn.email({ email, password, callbackURL: target })
        : signUp.email({ name, email, password, callbackURL: target });
    try {
      const { error: err } = await action;
      if (err) {
        const notVerified =
          err.code === "EMAIL_NOT_VERIFIED" ||
          err.status === 403 ||
          UNVERIFIED_EMAIL_RE.test(err.message ?? "");
        if (mode === "signin" && notVerified) {
          setError(
            "Confirme seu e-mail antes de entrar. Reenviamos o link de verificação."
          );
          await sendVerificationEmail({
            email,
            callbackURL: target,
          });
          return;
        }
        setError(failMessage);
        return;
      }
      window.location.href = target;
    } catch {
      setError(failMessage);
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
          <h1 className="font-bold font-display text-2xl text-foreground tracking-tight">
            {mode === "signin" ? "Entre na sua conta" : "Crie sua conta"}
          </h1>
          <p className="mt-1 mb-6 text-muted-foreground text-sm">
            {mode === "signin"
              ? "Bem-vindo de volta ao Quitto."
              : "É rápido e grátis."}
          </p>

          <Button
            className="w-full"
            disabled={loading}
            onClick={handleGoogle}
            type="button"
            variant="outline"
          >
            Continuar com Google
          </Button>

          <div className="my-4 flex items-center gap-2 text-muted-foreground text-xs">
            <span className="h-px flex-1 bg-border" />
            ou
            <span className="h-px flex-1 bg-border" />
          </div>

          <form className="space-y-3" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <div className="space-y-1">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  onChange={(e) => setName(e.target.value)}
                  required
                  value={name}
                />
              </div>
            )}
            <div className="space-y-1">
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
            <div className="space-y-1">
              <Label htmlFor="password">Senha</Label>
              <Input
                aria-describedby={error ? "auth-error" : undefined}
                aria-invalid={error ? true : undefined}
                id="password"
                onChange={(e) => setPassword(e.target.value)}
                required
                type="password"
                value={password}
              />
            </div>
            {mode === "signin" && (
              <a
                className="block text-right text-muted-foreground text-sm underline"
                href="/forgot-password"
              >
                Esqueci minha senha
              </a>
            )}
            {error && (
              <p
                className="text-destructive text-sm"
                id="auth-error"
                role="alert"
              >
                {error}
              </p>
            )}
            <Button className="w-full" disabled={loading} type="submit">
              {loading ? "Aguarde..." : submitLabel(mode)}
            </Button>
          </form>

          <button
            aria-label={
              mode === "signin"
                ? "Alternar para criar conta"
                : "Alternar para entrar"
            }
            className="mt-4 w-full text-center text-muted-foreground text-sm underline"
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
