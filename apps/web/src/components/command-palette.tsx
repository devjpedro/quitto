import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  FileText,
  LayoutDashboard,
  LogOut,
  Moon,
  Plus,
  Settings,
  Sun,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/legacy-ui/command";
import { Dialog, DialogContent } from "@/components/legacy-ui/dialog";
import { Sheet, SheetContent } from "@/components/legacy-ui/sheet";
import { Button } from "@/components/ui/button";
import { contractsQueryOptions } from "@/hooks/use-contracts";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { useSignOut } from "@/hooks/use-sign-out";
import { useTheme } from "@/hooks/use-theme";
import { commandFilter, sortByUrgency } from "@/lib/search";
import { m } from "@/paraglide/messages.js";

const EMPTY_STATE_LIMIT = 5;

/** Labels are functions: read on render, they follow the account's locale. */
const PAGES = [
  {
    to: "/",
    label: m.nav_now,
    icon: LayoutDashboard,
    keywords: ["agora", "now", "inicio", "home", "dashboard"],
  },
  {
    to: "/contracts",
    label: m.nav_contracts,
    icon: FileText,
    keywords: ["contratos", "lista"],
  },
  {
    to: "/settings",
    // Legacy copy, like the rest of the palette: i18n with its re-skin (Fase 5).
    label: () => "Conta",
    icon: Settings,
    keywords: ["conta", "perfil", "configuracoes", "ajustes"],
  },
] as const;

const CREATE_KEYWORDS = ["criar contrato", "novo contrato", "adicionar"];
const THEME_KEYWORDS = [
  "tema",
  "claro",
  "escuro",
  "dark",
  "light",
  "aparencia",
];
const SIGN_OUT_KEYWORDS = ["sair", "logout", "desconectar", "encerrar sessao"];
const NOTIFICATIONS_KEYWORDS = [
  "notificacoes",
  "notifications",
  "avisos",
  "sino",
  "bell",
];

/** The fixed commands' search terms, in the locale of the render. */
function staticKeywords(): string[][] {
  return [
    ...PAGES.map((page) => [page.label(), ...page.keywords]),
    CREATE_KEYWORDS,
    NOTIFICATIONS_KEYWORDS,
    THEME_KEYWORDS,
    SIGN_OUT_KEYWORDS,
  ];
}

interface SearchableContract {
  description: string | null;
  id: string;
  nextDueDate: string | null;
  overdueCount: number;
  participantNames: string[];
  title: string;
}

/**
 * Matéria de busca do contrato. Uma função só, consumida pelo `keywords` do
 * item E pelo cálculo de `hasResults` — se as duas divergirem, o cmdk e a
 * paleta discordam sobre o que é "nenhum resultado".
 */
function contractKeywords(contract: SearchableContract): string[] {
  return [
    contract.title,
    contract.description ?? "",
    ...contract.participantNames,
  ].filter(Boolean);
}

/** The contract list failed: says so in place, while every fixed command keeps working. */
function ContractsLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 border-line border-b px-4 py-3"
      role="alert"
    >
      <p className="text-ink text-sm">{m.palette_contracts_error()}</p>
      <Button
        onClick={onRetry}
        // cmdk handles Enter at its root for any target: it cancels the
        // button's own activation and runs the highlighted command instead.
        // Stopping it here lets Enter press this button, as it does anywhere.
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.stopPropagation();
          }
        }}
        size="sm"
        variant="secondary"
      >
        {m.section_retry()}
      </Button>
    </div>
  );
}

export function CommandPalette({
  open,
  onOpenChange,
  onOpenNotifications,
}: {
  onOpenChange: (v: boolean) => void;
  onOpenNotifications: () => void;
  open: boolean;
}) {
  const [query, setQuery] = useState("");
  const isDesktop = useIsDesktop();

  // The Dialog and the Sheet only mount their content while open, so the
  // commands (and the contract list they read) only exist with the palette open.
  const commands = (
    <PaletteCommands
      onOpenChange={onOpenChange}
      onOpenNotifications={onOpenNotifications}
      query={query}
      setQuery={setQuery}
    />
  );

  if (isDesktop) {
    return (
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent
          // A paleta não tem texto descritivo: o placeholder do campo já diz o
          // que ela faz. `undefined` explícito é o escape hatch do Radix para
          // não apontar `aria-describedby` para um Description inexistente.
          aria-describedby={undefined}
          className="max-w-xl"
          title="Buscar"
        >
          {commands}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        aria-describedby={undefined}
        className="max-w-full"
        title="Buscar"
      >
        {commands}
      </SheetContent>
    </Sheet>
  );
}

function PaletteCommands({
  query,
  setQuery,
  onOpenChange,
  onOpenNotifications,
}: {
  onOpenChange: (v: boolean) => void;
  onOpenNotifications: () => void;
  query: string;
  setQuery: (query: string) => void;
}) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const signOut = useSignOut();
  const inputRef = useRef<HTMLInputElement>(null);
  // Fetch on open: the palette sits on every `_app` route, but this component
  // only mounts while it is open, so a closed palette neither fetches the list
  // nor observes it, and a failure of it (a 500 or a timeout, from the
  // contracts page or from a fetch started here before closing) never reaches
  // it. Same queryKey and cache as `useContractsQuery`, so it reuses what the
  // contracts page already fetched. Open, the list fails here and not at the
  // route's boundary: the app's `throwOnError` would take the whole shell down.
  const contractsQuery = useQuery({
    ...contractsQueryOptions,
    throwOnError: false,
  });
  const { data } = contractsQuery;
  // With a list still on screen, a failed refetch is the global toast's job.
  const listFailed = contractsQuery.isError && data === undefined;

  // Query pendente ou em erro entra como lista vazia: os grupos "Ir para" e
  // "Ações" respondem sozinhos e a paleta nunca fica inerte.
  const contracts: SearchableContract[] = data ?? [];

  const visible = useMemo(
    () =>
      query === ""
        ? sortByUrgency(contracts).slice(0, EMPTY_STATE_LIMIT)
        : contracts,
    [contracts, query]
  );

  // Mesmo scorer que o cmdk usa no `filter`, então os dois sempre concordam
  // sobre o que é "nenhum resultado".
  const hasResults = useMemo(() => {
    if (query === "") {
      return true;
    }
    const haystacks = [...visible.map(contractKeywords), ...staticKeywords()];
    return haystacks.some((keywords) => commandFilter("", query, keywords) > 0);
  }, [query, visible]);

  function run(action: () => void) {
    onOpenChange(false);
    setQuery("");
    action();
  }

  const isDark = theme === "dark";

  // O cmdk só reelege o "primeiro item" quando a BUSCA muda: itens que montam
  // depois entram sem seleção e o Enter fica inerte. Como o `GET /contracts`
  // só sai na abertura, digitar rápido cai exatamente nessa janela.
  // Re-montar o Command uma única vez, quando a lista chega, faz
  // o cmdk reaplicar a busca atual já com os itens no DOM. O texto digitado é
  // estado nosso (`query`), então sobrevive; o `autoFocus` devolve o cursor.
  const listKey = data === undefined ? "aguardando-contratos" : "com-contratos";

  return (
    <Command filter={commandFilter} key={listKey} label="Buscar">
      {/* `autoFocus` NÃO é mais para vencer o Radix na montagem: com o "Fechar"
          movido para depois do `{children}` (dialog.tsx/sheet.tsx), o primeiro
          tabbable do content já é este campo e o Radix foca nele sozinho.
          O que ainda o sustenta é o remount do `key={listKey}` abaixo: quando a
          lista chega, este input é destruído e recriado, o foco cai fora do
          escopo e o FocusScope do Radix o estaciona no container do diálogo —
          não de volta no campo. Sem `autoFocus` o cursor se perde exatamente
          nessa janela, que é onde os dois testes de digitação da paleta batem.
          Verificado por falsificação: removido, `command-palette.spec.ts:46` e
          `:90` ficam vermelhos; com o Fechar reordenado mas sem o remount, o
          foco de montagem cai no campo sozinho. */}
      <CommandInput
        autoFocus
        onValueChange={setQuery}
        placeholder="Buscar contratos, páginas e ações…"
        ref={inputRef}
        value={query}
      />
      {listFailed ? (
        <ContractsLoadError
          onRetry={() => {
            // The alert (and this button) leave while the list loads again:
            // the cursor goes back to the field instead of the dialog's frame.
            inputRef.current?.focus();
            contractsQuery.refetch();
          }}
        />
      ) : null}
      {/* `label` explícito: sem ele o cmdk nomeia a listbox de "Suggestions". */}
      <CommandList label="Sugestões">
        {query !== "" && !hasResults ? (
          // `forceMount` no grupo E no item: o grupo sem nenhum item aprovado
          // pelo filtro sai com `hidden`, e esconderia o item de criar junto.
          <CommandGroup forceMount heading="Criar">
            <CommandItem
              forceMount
              keywords={[query]}
              onSelect={() =>
                run(() =>
                  navigate({ to: "/contracts/new", search: { title: query } })
                )
              }
              value="criar-do-zero"
            >
              <Plus aria-hidden="true" className="size-4 shrink-0 opacity-60" />
              <span className="truncate">Criar contrato "{query}"</span>
            </CommandItem>
          </CommandGroup>
        ) : null}

        {visible.length > 0 ? (
          <CommandGroup heading="Contratos">
            {visible.map((contrato) => (
              <CommandItem
                key={contrato.id}
                keywords={contractKeywords(contrato)}
                onSelect={() =>
                  run(() =>
                    navigate({
                      to: "/contracts/$id",
                      params: { id: contrato.id },
                      // A rota exige `search`; sem deep-link de parcela aqui.
                      search: { installment: undefined },
                    })
                  )
                }
                value={contrato.id}
              >
                <FileText
                  aria-hidden="true"
                  className="size-4 shrink-0 opacity-60"
                />
                <span className="truncate">{contrato.title}</span>
                {contrato.overdueCount > 0 ? (
                  <span className="ml-auto shrink-0 text-destructive text-xs">
                    {contrato.overdueCount === 1
                      ? "1 vencida"
                      : `${contrato.overdueCount} vencidas`}
                  </span>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        <CommandGroup heading="Ir para">
          {PAGES.map((page) => {
            const Icon = page.icon;
            return (
              <CommandItem
                key={page.to}
                keywords={[page.label(), ...page.keywords]}
                onSelect={() => run(() => navigate({ to: page.to }))}
                value={`ir-para-${page.to}`}
              >
                <Icon
                  aria-hidden="true"
                  className="size-4 shrink-0 opacity-60"
                />
                <span>{page.label()}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandGroup heading="Ações">
          <CommandItem
            keywords={CREATE_KEYWORDS}
            onSelect={() => run(() => navigate({ to: "/contracts/new" }))}
            value="acao-criar-contrato"
          >
            <Plus aria-hidden="true" className="size-4 shrink-0 opacity-60" />
            <span>Criar contrato</span>
          </CommandItem>
          <CommandItem
            keywords={NOTIFICATIONS_KEYWORDS}
            onSelect={() => run(onOpenNotifications)}
            value="acao-notificacoes"
          >
            <Bell aria-hidden="true" className="size-4 shrink-0 opacity-60" />
            <span>{m.nav_notifications()}</span>
          </CommandItem>
          <CommandItem
            keywords={THEME_KEYWORDS}
            onSelect={() => run(() => setTheme(isDark ? "light" : "dark"))}
            value="acao-alternar-tema"
          >
            {isDark ? (
              <Sun aria-hidden="true" className="size-4 shrink-0 opacity-60" />
            ) : (
              <Moon aria-hidden="true" className="size-4 shrink-0 opacity-60" />
            )}
            <span>{isDark ? "Ativar tema claro" : "Ativar tema escuro"}</span>
          </CommandItem>
          <CommandItem
            keywords={SIGN_OUT_KEYWORDS}
            onSelect={() => run(signOut)}
            value="acao-sair"
          >
            <LogOut aria-hidden="true" className="size-4 shrink-0 opacity-60" />
            <span>Sair</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
