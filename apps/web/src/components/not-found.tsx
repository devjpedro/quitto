import { Link } from "@tanstack/react-router";
import { Button } from "@/components/legacy-ui/button";
import { LogoMark } from "@/components/logo";

export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <LogoMark />
      <p className="font-semibold text-foreground text-xl">
        Página não encontrada
      </p>
      <p className="text-muted-foreground text-sm">
        A página que você procura não existe ou foi movida.
      </p>
      <Button asChild>
        <Link to="/">Voltar ao início</Link>
      </Button>
    </div>
  );
}
