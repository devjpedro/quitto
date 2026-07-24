import { useMemo } from "react";
import { renderSVG } from "uqr";
import { CopyButton } from "@/components/copy-button";

/**
 * Bloco "Pague com PIX": QR + copia-e-cola + copiar. O QR fica sempre sobre
 * fundo branco (independente do tema) para garantir contraste ao leitor de
 * banco; a quiet zone é preservada pela borda do uqr.
 */
export function PixBlock({
  pix,
}: {
  pix: { copiaECola: string; keyType: string };
}) {
  const svg = useMemo(
    () => renderSVG(pix.copiaECola, { border: 2 }),
    [pix.copiaECola]
  );

  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        Pague com PIX
      </h3>
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
        <div
          aria-label="QR Code PIX"
          className="w-40 rounded-lg bg-white p-2"
          // svg determinístico gerado a partir da nossa própria string (sem HTML de usuário)
          // biome-ignore lint/security/noDangerouslySetInnerHtml: svg gerado por uqr a partir de dados nossos, sem HTML de usuário
          dangerouslySetInnerHTML={{ __html: svg }}
          role="img"
        />
        <p className="w-full break-all rounded-lg bg-muted px-3 py-2 text-muted-foreground text-xs tabular-nums">
          {pix.copiaECola}
        </p>
        <CopyButton value={pix.copiaECola} />
      </div>
    </section>
  );
}
