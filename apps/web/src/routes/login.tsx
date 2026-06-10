import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp } from "@/lib/auth-client";

function submitLabel(mode: "signin" | "signup") {
  return mode === "signin" ? "Entrar" : "Criar conta";
}

export function LoginPage() {
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
        ? signIn.email({ email, password, callbackURL: "/" })
        : signUp.email({ name, email, password, callbackURL: "/" });
    try {
      const { error: err } = await action;
      if (err) {
        setError(
          "Não foi possível entrar. Verifique os dados e tente novamente."
        );
        return;
      }
      window.location.href = "/";
    } catch {
      setError(
        "Não foi possível entrar. Verifique os dados e tente novamente."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="mb-1 font-bold text-foreground text-xl">Quitto</h1>
        <p className="mb-6 text-muted-foreground text-sm">
          {mode === "signin" ? "Entre na sua conta" : "Crie sua conta"}
        </p>

        <Button
          className="mb-4 w-full"
          disabled={loading}
          onClick={() =>
            signIn.social({ provider: "google", callbackURL: "/" })
          }
          type="button"
          variant="outline"
        >
          Continuar com Google
        </Button>

        <div className="mb-4 flex items-center gap-2 text-muted-foreground text-xs">
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
              id="password"
              onChange={(e) => setPassword(e.target.value)}
              required
              type="password"
              value={password}
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button className="w-full" disabled={loading} type="submit">
            {loading ? "Aguarde..." : submitLabel(mode)}
          </Button>
        </form>

        <button
          className="mt-4 w-full text-center text-muted-foreground text-sm underline"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
          }}
          type="button"
        >
          {mode === "signin"
            ? "Não tem conta? Cadastre-se"
            : "Já tem conta? Entre"}
        </button>
      </Card>
    </main>
  );
}
