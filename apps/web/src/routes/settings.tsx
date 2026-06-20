import { Download } from "lucide-react";
import { ChangePasswordForm } from "@/components/change-password-form";
import { DeleteAccountDialog } from "@/components/delete-account-dialog";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { PAGE_TITLE } from "@/lib/page-title";

export function SettingsPage() {
  useDocumentTitle(PAGE_TITLE.settings);
  return (
    <div className="mx-auto max-w-2xl p-6">
      <header className="mb-6">
        <h1 className="font-bold font-display text-2xl text-foreground tracking-tight">
          Conta
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Gerencie seus dados e o acesso à sua conta.
        </p>
      </header>

      <section className="mb-8 rounded-xl border border-border bg-card p-5 shadow-xs">
        <h2 className="font-display font-semibold text-foreground tracking-tight">
          Exportar meus dados
        </h2>
        <p className="mt-1 mb-4 text-muted-foreground text-sm leading-relaxed">
          Baixe um arquivo JSON com seus contratos, parcelas e notificações.
        </p>
        <a
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3.5 py-2 font-medium text-foreground text-sm shadow-xs transition-colors hover:border-primary/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          download
          href="/api/me/export"
        >
          <Download aria-hidden="true" className="size-4 opacity-70" />
          Exportar meus dados
        </a>
      </section>

      <section className="mb-8 rounded-xl border border-border bg-card p-5 shadow-xs">
        <h2 className="mb-3 font-display font-semibold text-foreground tracking-tight">
          Trocar senha
        </h2>
        <ChangePasswordForm />
      </section>

      <section>
        <h2 className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Zona de perigo
        </h2>
        <DeleteAccountDialog />
      </section>
    </div>
  );
}
