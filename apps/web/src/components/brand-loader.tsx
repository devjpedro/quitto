import { LogoMark } from "@/components/logo";

/**
 * Loading característico do Quitto: o anel de quitação do logo animado,
 * sobre o fundo de token (light/dark) com um halo teal (--primary) sutil.
 */
export function BrandLoader({ label = "Carregando…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background"
      role="status"
    >
      <span className="brand-loader-ring rounded-full ring-4 ring-primary/15">
        <LogoMark size={48} />
      </span>
      <span className="text-muted-foreground text-sm">{label}</span>
    </div>
  );
}
