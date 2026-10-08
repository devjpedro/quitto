import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Emphasis } from "@/components/ui/emphasis";
import { TextField } from "@/components/ui/field";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { pluralForm } from "@/lib/plural";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { useDeleteAccount, useDeletionSummary } from "../api";

/** The most faces in the row of who loses access; the rest is "+N". */
const FACES = 5;

type Summary = NonNullable<ReturnType<typeof useDeletionSummary>["data"]>;

function summaryText(summary: Summary): string {
  const locale = getLocale();
  const contracts =
    pluralForm(summary.contracts, locale) === "one"
      ? m.settings_delete_contracts_one()
      : m.settings_delete_contracts_other({ count: summary.contracts });
  const installments =
    pluralForm(summary.installments, locale) === "one"
      ? m.settings_delete_installments_one()
      : m.settings_delete_installments_other({ count: summary.installments });
  return m.settings_delete_summary({ contracts, installments });
}

/** The people who lose access to what is deleted, with their faces (mockup 18, decision 5). */
function Losing({ people }: { people: Summary["people"] }) {
  if (people.length === 0) {
    return null;
  }
  const shown = people.slice(0, FACES);
  const extra = people.length - shown.length;
  const text =
    pluralForm(people.length, getLocale()) === "one"
      ? m.settings_delete_people_one({ count: people.length })
      : m.settings_delete_people_other({ count: people.length });
  return (
    <div className="mt-4 flex items-center gap-3 rounded-control bg-surface-card px-3 py-2.5">
      <span aria-hidden="true" className="flex">
        {shown.map((person) => (
          <span
            className="-ml-1 rounded-full ring-2 ring-surface-card first:ml-0"
            key={person.name}
          >
            <PersonAvatar name={person.name} size="sm" />
          </span>
        ))}
        {extra > 0 ? (
          <span className="-ml-1 inline-flex size-6 items-center justify-center rounded-full bg-surface-inset font-semibold text-[10px] text-ink-muted tabular-nums ring-2 ring-surface-card">
            +{extra}
          </span>
        ) : null}
      </span>
      <span className="text-[13px] text-ink-muted">{text}</span>
    </div>
  );
}

/**
 * Excluir a conta: says what goes away (the contracts the account created,
 * their installments, and the people who lose access, with their faces) and
 * asks for the phrase of the language (EXCLUIR / DELETE). The cursor opens in
 * the field, and closing hands the focus back to the button that opened it.
 */
export function DeleteAccountDialog({
  onOpenChange,
  open,
  restoreFocus,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  restoreFocus: () => void;
}) {
  const [phrase, setPhrase] = useState("");
  const remove = useDeleteAccount();
  const { data: summary } = useDeletionSummary(open);
  const expected = m.settings_delete_phrase();
  const matches = phrase === expected;
  const mismatch = phrase.length > 0 && !matches;

  return (
    <Dialog
      description={summary ? summaryText(summary) : undefined}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} variant="ghost">
            {m.settings_delete_cancel()}
          </Button>
          <Button
            disabled={!matches || remove.isPending}
            onClick={() => remove.mutate()}
            variant="danger"
          >
            {remove.isPending
              ? m.settings_delete_pending()
              : m.settings_delete_confirm()}
          </Button>
        </>
      }
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        restoreFocus();
      }}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        document.getElementById("confirm-phrase")?.focus();
      }}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setPhrase("");
          remove.reset();
        }
      }}
      open={open}
      title={m.settings_delete_title()}
    >
      {summary ? <Losing people={summary.people} /> : null}
      <div className="mt-4">
        <TextField
          autoComplete="off"
          error={mismatch ? m.settings_delete_phrase_mismatch() : undefined}
          id="confirm-phrase"
          label={
            <Emphasis
              strong={expected}
              text={m.settings_delete_phrase_label({ phrase: expected })}
            />
          }
          onChange={(event) => setPhrase(event.target.value)}
          spellCheck={false}
          value={phrase}
        />
      </div>
      {remove.isError ? (
        <p className="mt-3 text-danger text-sm" role="alert">
          {m.settings_delete_failed()}
        </p>
      ) : null}
    </Dialog>
  );
}
