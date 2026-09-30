import type { PublicReceipt } from "@quitto/shared";
import { Download } from "lucide-react";
import { Logo } from "@/components/logo";
import { Money } from "@/components/money";
import { formatISODateBR } from "@/lib/format";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-8 px-4 py-10 print:py-0">
      <Logo />
      {children}
      <p className="mt-auto text-subtle-foreground text-xs">
        Emitido pelo Quitto · este recibo pode ser revogado por quem o emitiu.
      </p>
    </main>
  );
}

export function PublicReceiptPage({
  receipt,
  token,
}: {
  receipt: PublicReceipt;
  token: string;
}) {
  const rows: [string, string][] = [["Contrato", receipt.contractTitle]];
  if (receipt.receiverName) {
    rows.push(["Recebedor", receipt.receiverName]);
  }
  if (receipt.payerName) {
    rows.push(["Pagador", receipt.payerName]);
  }
  return (
    <Shell>
      <section className="flex flex-col gap-2">
        <h1 className="font-semibold text-muted-foreground text-sm">
          Recibo de pagamento
        </h1>
        <Money cents={receipt.amountCents} size="hero" />
        <p className="text-muted-foreground text-sm tabular-nums">
          Parcela {receipt.sequence} de {receipt.installmentsCount} · paga em{" "}
          {formatISODateBR(receipt.paidAt)}
        </p>
      </section>
      <dl className="divide-y divide-border/60 rounded-xl border border-border bg-card">
        {rows.map(([label, value]) => (
          <div
            className="flex items-baseline justify-between gap-4 p-4"
            key={label}
          >
            <dt className="text-muted-foreground text-sm">{label}</dt>
            <dd className="text-right font-medium text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      <a
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 font-medium text-primary-foreground print:hidden"
        download
        href={`/api/public/receipts/${token}/receipt.pdf`}
      >
        <Download aria-hidden="true" className="size-4" />
        Baixar PDF
      </a>
    </Shell>
  );
}

export function PublicReceiptUnavailable() {
  return (
    <Shell>
      <section className="flex flex-col gap-2">
        <h1 className="font-semibold text-foreground text-xl">
          Este recibo não está disponível.
        </h1>
        <p className="text-muted-foreground text-sm">
          O link pode ter sido revogado por quem o enviou.
        </p>
      </section>
    </Shell>
  );
}
