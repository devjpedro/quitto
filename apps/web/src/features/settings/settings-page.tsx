import { Download } from "lucide-react";
import type { ReactNode } from "react";
import { ChangePasswordForm } from "@/components/change-password-form";
import { DeleteAccountDialog } from "@/components/delete-account-dialog";
import { PageContainer } from "@/components/page-container";
import { ThemeToggle } from "@/components/theme-toggle";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useMeQuery } from "@/hooks/use-me";
import { PAGE_TITLE } from "@/lib/page-title";

/** Card section shared by every "Conta" concern (Perfil, Segurança, ...). */
function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] sm:p-6">
      <h2 className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function SettingsPage() {
  useDocumentTitle(PAGE_TITLE.settings);
  const { data: me } = useMeQuery();

  return (
    <PageContainer width="form">
      <header className="mb-6">
        <h1 className="font-bold text-2xl text-foreground tracking-tight">
          Conta
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Gerencie seus dados e o acesso à sua conta.
        </p>
      </header>

      <div className="flex flex-col gap-5">
        <SettingsSection title="Perfil">
          <div className="flex flex-col gap-0.5">
            <p className="truncate font-medium text-foreground text-sm">
              {me?.name ?? "..."}
            </p>
            <p className="truncate text-muted-foreground text-sm">
              {me?.email ?? ""}
            </p>
          </div>
        </SettingsSection>

        <SettingsSection title="Segurança">
          <ChangePasswordForm />
        </SettingsSection>

        <SettingsSection title="Aparência">
          <div className="flex items-center justify-between gap-4">
            <span className="text-foreground text-sm">Tema</span>
            <ThemeToggle />
          </div>
        </SettingsSection>

        <SettingsSection title="Dados & privacidade">
          <p className="mb-4 text-muted-foreground text-sm leading-relaxed">
            Baixe um arquivo JSON com seus contratos, parcelas e notificações.
          </p>
          <a
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3.5 py-2 font-medium text-foreground text-sm shadow-xs transition-colors hover:border-primary/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.97]"
            download
            href="/api/me/export"
          >
            <Download aria-hidden="true" className="size-4 opacity-70" />
            Exportar meus dados
          </a>
        </SettingsSection>

        <section>
          <h2 className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Zona de perigo
          </h2>
          <DeleteAccountDialog />
        </section>
      </div>
    </PageContainer>
  );
}
