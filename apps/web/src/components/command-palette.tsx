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
import { useMemo, useState } from "react";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/legacy-ui/command";
import { Dialog, DialogContent } from "@/components/legacy-ui/dialog";
import { Sheet, SheetContent } from "@/components/legacy-ui/sheet";
import { contractsQueryOptions } from "@/hooks/use-contracts";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { useSignOut } from "@/hooks/use-sign-out";
import { useTheme } from "@/hooks/use-theme";
import { commandFilter, sortByUrgency } from "@/lib/search";

const EMPTY_STATE_LIMIT = 5;

const PAGES = [
  {
    to: "/",
    label: "Agora",
    icon: LayoutDashboard,
    keywords: ["agora", "inicio", "home", "dashboard"],
  },
  {
    to: "/contracts",
    label: "Contratos",
    icon: FileText,
    keywords: ["contratos", "lista"],
  },
  {
    to: "/settings",
    label: "Conta",
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
const NOTIFICATIONS_KEYWORDS = ["notificacoes", "avisos", "sino"];

const STATIC_KEYWORDS: string[][] = [
  ...PAGES.map((page) => [page.label, ...page.keywords]),
  CREATE_KEYWORDS,
  NOTIFICATIONS_KEYWORDS,
  THEME_KEYWORDS,
  SIGN_OUT_KEYWORDS,
];

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
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const signOut = useSignOut();
  const isDesktop = useIsDesktop();
  // fetch-on-first-open: a paleta monta em TODA rota do `_app`, então buscar
  // aqui de forma incondicional seria um `GET /api/contracts` por página.
  // Mesma queryKey e mesmo cache do `useContractsQuery` — a paleta reaproveita
  // o que a lista de contratos já buscou, só não dispara nada sozinha fechada.
  const { data } = useQuery({ ...contractsQueryOptions, enabled: open });

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
    const haystacks = [...visible.map(contractKeywords), ...STATIC_KEYWORDS];
    return haystacks.some((keywords) => commandFilter("", query, keywords) > 0);
  }, [query, visible]);

  function run(action: () => void) {
    onOpenChange(false);
    setQuery("");
    action();
  }

  const isDark = theme === "dark";

  // O cmdk só reelege o "primeiro item" quando a BUSCA muda: itens que montam
  // depois entram sem seleção e o Enter fica inerte. Com `enabled: open` o
  // `GET /contracts` só sai na abertura, então digitar rápido cai exatamente
  // nessa janela. Re-montar o Command uma única vez, quando a lista chega, faz
  // o cmdk reaplicar a busca atual já com os itens no DOM. O texto digitado é
  // estado nosso (`query`), então sobrevive; o `autoFocus` devolve o cursor.
  const listKey = data === undefined ? "aguardando-contratos" : "com-contratos";

  const content = (
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
        value={query}
      />
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
                keywords={[page.label, ...page.keywords]}
                onSelect={() => run(() => navigate({ to: page.to }))}
                value={`ir-para-${page.to}`}
              >
                <Icon
                  aria-hidden="true"
                  className="size-4 shrink-0 opacity-60"
                />
                <span>{page.label}</span>
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
            <span>Notificações</span>
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
          {content}
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
        {content}
      </SheetContent>
    </Sheet>
  );
}
