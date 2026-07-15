import { LogoMark } from "@/components/logo";

/**
 * Loading característico do Quitto: o anel de quitação do logo animado.
 * (Versão spine — a lapidação de mola/timing/dark é do design system, workstream B.)
 */
export function BrandLoader({ label = "Carregando…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4"
      role="status"
    >
      <span className="brand-loader-ring">
        <LogoMark size={48} />
      </span>
      <span className="text-muted-foreground text-sm">{label}</span>
    </div>
  );
}
