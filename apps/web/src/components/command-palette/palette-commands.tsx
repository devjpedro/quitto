import {
  Bell,
  GearSix,
  MagnifyingGlass,
  Moon,
  Plus,
  SignOut,
  Sun,
  Translate,
} from "@phosphor-icons/react";
import { LOCALES } from "@quitto/shared";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Command } from "cmdk";
import { useMemo, useRef } from "react";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Tag } from "@/components/ui/tag";
import { peopleQueryOptions } from "@/features/people/api";
import type { Person } from "@/features/people/types";
import { useChangeLocale } from "@/hooks/use-change-locale";
import { contractsQueryOptions } from "@/hooks/use-contracts";
import { meQueryOptions } from "@/hooks/use-me";
import { useSignOut } from "@/hooks/use-sign-out";
import { useTheme } from "@/hooks/use-theme";
import { LOCALE_NAME } from "@/lib/locale-names";
import { pluralForm } from "@/lib/plural";
import { commandFilter, sortByUrgency } from "@/lib/search";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import {
  CREATE_KEYWORDS,
  LANGUAGE_KEYWORDS,
  NOTIFICATIONS_KEYWORDS,
  PALETTE_PAGES,
  PALETTE_SETTINGS,
  SIGN_OUT_KEYWORDS,
  THEME_KEYWORDS,
} from "./palette-pages";
import {
  ContractsLoadError,
  OverdueTag,
  PaletteGroup,
  PaletteIcon,
  PaletteItem,
} from "./palette-parts";

const EMPTY_STATE_LIMIT = 5;

interface SearchableContract {
  description: string | null;
  id: string;
  installmentsCount: number;
  nextDueDate: string | null;
  overdueCount: number;
  paidCount: number;
  participantNames: string[];
  percent: number;
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

function personKeywords(person: Person): string[] {
  return [person.name, person.email ?? ""].filter(Boolean);
}

/** "te paga · 1 contrato": the direction of what is owed, and how many contracts they share. */
function relation(person: Person): string {
  const count = person.contracts.length;
  const contracts =
    pluralForm(count, getLocale()) === "one"
      ? m.people_page_contracts_one()
      : m.people_page_contracts_other({ count });
  if (person.owesYouCents > 0 && person.youOweCents > 0) {
    return m.palette_person_both({ contracts });
  }
  if (person.owesYouCents > 0) {
    return m.palette_person_pays_you({ contracts });
  }
  if (person.youOweCents > 0) {
    return m.palette_person_you_pay({ contracts });
  }
  return m.palette_person_settled({ contracts });
}

function overdueLabel(count: number): string {
  return pluralForm(count, getLocale()) === "one"
    ? m.palette_overdue_one()
    : m.palette_overdue_other({ count });
}

/** The fixed commands' search terms, in the language of the render. */
function staticKeywords(): string[][] {
  return [
    ...PALETTE_PAGES.map((page) => [page.label(), ...page.keywords]),
    ...PALETTE_SETTINGS.map((entry) => [entry.label(), ...entry.keywords]),
    CREATE_KEYWORDS,
    NOTIFICATIONS_KEYWORDS,
    THEME_KEYWORDS,
    LANGUAGE_KEYWORDS,
    SIGN_OUT_KEYWORDS,
  ];
}

/**
 * The palette's content (mockup 18, frames G): the search field, then
 * Contratos, Pessoas, Ir para and Ações. It only mounts with the palette
 * open, so a closed palette neither fetches the lists nor sees them fail.
 */
export function PaletteCommands({
  onOpenChange,
  onOpenNotifications,
  query,
  setQuery,
}: {
  onOpenChange: (open: boolean) => void;
  onOpenNotifications: () => void;
  query: string;
  setQuery: (query: string) => void;
}) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const signOut = useSignOut();
  const changeLocale = useChangeLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  // Same queryKey and cache as the Contratos list, so it reuses what that page
  // fetched. Open, the list fails here and not at the route's boundary: the
  // app's `throwOnError` would take the whole shell down.
  const contractsQuery = useQuery({
    ...contractsQueryOptions,
    throwOnError: false,
  });
  const peopleQuery = useQuery({ ...peopleQueryOptions, throwOnError: false });
  const meQuery = useQuery({ ...meQueryOptions, throwOnError: false });
  const { data } = contractsQuery;
  // With a list still on screen, a failed refetch is the global toast's job.
  const listFailed = contractsQuery.isError && data === undefined;

  // Pending or failed enters as an empty list: "Ir para" and "Ações" answer on
  // their own, and the palette is never inert.
  const contracts: SearchableContract[] = data ?? [];
  const people: Person[] = peopleQuery.data?.people ?? [];

  const visible = useMemo(
    () =>
      query === ""
        ? sortByUrgency(contracts).slice(0, EMPTY_STATE_LIMIT)
        : contracts,
    [contracts, query]
  );
  // With nothing typed the palette suggests contracts, not people.
  const visiblePeople = query === "" ? [] : people;
  const sections = PALETTE_SETTINGS.filter(
    (entry) =>
      entry.section !== "reminders" ||
      meQuery.data?.emailRemindersAvailable === true
  );

  // The same scorer cmdk uses in `filter`, so both always agree on what "no
  // results" means.
  const hasResults = useMemo(() => {
    if (query === "") {
      return true;
    }
    const haystacks = [
      ...visible.map(contractKeywords),
      ...visiblePeople.map(personKeywords),
      ...staticKeywords(),
    ];
    return haystacks.some((keywords) => commandFilter("", query, keywords) > 0);
  }, [query, visible, visiblePeople]);

  function run(action: () => void) {
    onOpenChange(false);
    setQuery("");
    action();
  }

  const isDark = theme === "dark";
  const other = LOCALES.find((locale) => locale !== getLocale()) ?? "en-US";

  // cmdk only re-elects the "first item" when the SEARCH changes: items that
  // mount later come in unselected and Enter does nothing. The contract list is
  // fetched on open, so typing fast lands exactly there. Remounting the Command
  // once, when the list arrives, makes cmdk apply the current search with the
  // items in the DOM. The typed text is ours (`query`), so it survives.
  const listKey = data === undefined ? "aguardando-contratos" : "com-contratos";

  return (
    <Command
      className="flex min-h-0 flex-1 flex-col"
      filter={commandFilter}
      key={listKey}
      label={m.palette_label()}
    >
      {/* `autoFocus` keeps the cursor in the field: when the list arrives, this
          input is destroyed and recreated by the `key` above, and the focus
          would otherwise fall out of the dialog's scope. */}
      <div className="flex h-14 shrink-0 items-center gap-3 px-4 max-md:pr-24 md:px-5">
        <MagnifyingGlass
          aria-hidden="true"
          className="shrink-0 text-ink-muted"
          size={20}
        />
        <Command.Input
          autoFocus
          className="h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-muted"
          onValueChange={setQuery}
          placeholder={m.palette_placeholder()}
          ref={inputRef}
          value={query}
        />
        <Tag aria-hidden="true" className="max-md:hidden" tone="sunken">
          {m.palette_esc()}
        </Tag>
      </div>
      {/* A straight element of its own: the panel has a radius, so no border-top. */}
      <div
        aria-hidden="true"
        className="h-px shrink-0 bg-divider dark:bg-line-strong"
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
      <Command.List
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
        label={m.palette_list()}
      >
        {query !== "" && !hasResults ? (
          // `forceMount` on the group AND the item: a group with no item passed
          // by the filter leaves `hidden`, and would hide the create item too.
          <PaletteGroup forceMount heading={m.palette_group_create()}>
            <PaletteItem
              anchor={<PaletteIcon icon={Plus} />}
              forceMount
              keywords={[query]}
              onSelect={() =>
                run(() =>
                  navigate({ to: "/contracts/new", search: { title: query } })
                )
              }
              value="criar-do-zero"
            >
              <span className="truncate">
                {m.palette_create_from({ query })}
              </span>
            </PaletteItem>
          </PaletteGroup>
        ) : null}

        {visible.length > 0 ? (
          <PaletteGroup heading={m.palette_group_contracts()}>
            {visible.map((contract) => (
              <PaletteItem
                anchor={<ProgressRing percent={contract.percent} size={16} />}
                end={`${contract.paidCount}/${contract.installmentsCount}`}
                key={contract.id}
                keywords={contractKeywords(contract)}
                onSelect={() =>
                  run(() =>
                    navigate({
                      to: "/contracts/$id",
                      params: { id: contract.id },
                      // The route requires `search`; no installment deep link here.
                      search: { installment: undefined },
                    })
                  )
                }
                value={contract.id}
              >
                <span className="truncate">{contract.title}</span>
                {contract.overdueCount > 0 ? (
                  <OverdueTag label={overdueLabel(contract.overdueCount)} />
                ) : null}
              </PaletteItem>
            ))}
          </PaletteGroup>
        ) : null}

        {visiblePeople.length > 0 ? (
          <PaletteGroup heading={m.palette_group_people()}>
            {visiblePeople.map((person) => (
              <PaletteItem
                anchor={<PersonAvatar name={person.name} size="sm" />}
                end={relation(person)}
                key={person.key}
                keywords={personKeywords(person)}
                onSelect={() =>
                  run(() =>
                    navigate({ to: "/people", search: { person: person.key } })
                  )
                }
                value={`pessoa-${person.key}`}
              >
                <span className="truncate">{person.name}</span>
              </PaletteItem>
            ))}
          </PaletteGroup>
        ) : null}

        <PaletteGroup heading={m.palette_group_pages()}>
          {PALETTE_PAGES.map((page) => (
            <PaletteItem
              anchor={<PaletteIcon icon={page.icon} />}
              key={page.to}
              keywords={[page.label(), ...page.keywords]}
              onSelect={() => run(() => navigate({ to: page.to }))}
              value={`ir-para-${page.to}`}
            >
              {page.label()}
            </PaletteItem>
          ))}
          {query === ""
            ? null
            : sections.map((entry) => (
                <PaletteItem
                  anchor={<PaletteIcon icon={GearSix} />}
                  key={entry.section}
                  keywords={[entry.label(), ...entry.keywords]}
                  onSelect={() =>
                    run(() =>
                      navigate({
                        to: "/settings/$section",
                        params: { section: entry.section },
                      })
                    )
                  }
                  value={`ajustes-${entry.section}`}
                >
                  {m.account_settings()} · {entry.label()}
                </PaletteItem>
              ))}
        </PaletteGroup>

        <PaletteGroup heading={m.palette_group_actions()}>
          <PaletteItem
            anchor={<PaletteIcon icon={Plus} />}
            keywords={CREATE_KEYWORDS}
            onSelect={() => run(() => navigate({ to: "/contracts/new" }))}
            value="acao-criar-contrato"
          >
            {m.nav_new_contract()}
          </PaletteItem>
          <PaletteItem
            anchor={<PaletteIcon icon={Bell} />}
            keywords={NOTIFICATIONS_KEYWORDS}
            onSelect={() => run(onOpenNotifications)}
            value="acao-notificacoes"
          >
            {m.nav_notifications()}
          </PaletteItem>
          <PaletteItem
            anchor={<PaletteIcon icon={isDark ? Sun : Moon} />}
            keywords={THEME_KEYWORDS}
            onSelect={() => run(() => setTheme(isDark ? "light" : "dark"))}
            value="acao-alternar-tema"
          >
            {isDark ? m.palette_theme_light() : m.palette_theme_dark()}
          </PaletteItem>
          <PaletteItem
            anchor={<PaletteIcon icon={Translate} />}
            keywords={[...LANGUAGE_KEYWORDS, LOCALE_NAME[other]]}
            onSelect={() => run(() => changeLocale(other))}
            value="acao-idioma"
          >
            {m.palette_language({ language: LOCALE_NAME[other] })}
          </PaletteItem>
          <PaletteItem
            anchor={<PaletteIcon icon={SignOut} />}
            keywords={SIGN_OUT_KEYWORDS}
            onSelect={() => run(signOut)}
            value="acao-sair"
          >
            {m.account_sign_out()}
          </PaletteItem>
        </PaletteGroup>
      </Command.List>
    </Command>
  );
}
