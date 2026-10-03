import { useId } from "react";
import { Money } from "@/components/ui/money";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/utils";
import { getLocale } from "@/paraglide/runtime.js";
import { useActionHandlers } from "../hooks/use-action-handlers";
import { actionButtons, describeAction } from "../lib/action-view";
import type { HomeAction } from "../types";
import { ActionButton, type CardButtonVariant } from "./action-button";

function buttonVariant(first: boolean, index: number): CardButtonVariant {
  if (!first) {
    return "secondary";
  }
  return index === 0 ? "onBrand" : "onBrandOutline";
}

/** One thing to do. The first card is the green "Faça primeiro"; the rest are white with a border. */
export function ActionCard({
  action,
  first,
  onActionStart,
  today,
  tryLock,
}: {
  action: HomeAction;
  first: boolean;
  onActionStart: (id: string) => void;
  today: string;
  tryLock: () => boolean;
}) {
  const locale = getLocale();
  const titleId = useId();
  const view = describeAction(action, { first, locale, today });
  const { busy, run } = useActionHandlers(action, tryLock, () =>
    onActionStart(action.id)
  );
  const muted = first ? "text-on-brand-muted" : "text-ink-muted";
  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        // Every card has the 1 px border (the green one in its own color, as
        // in mockup 11), so the content lines up across the row.
        "flex h-full flex-col gap-1.5 rounded-card border p-4",
        first
          ? "border-brand-surface bg-brand-surface text-on-brand"
          : "border-line bg-surface-raised text-ink"
      )}
    >
      <Tag tone={view.tone}>{view.tag}</Tag>
      <p className={cn("text-xs", muted)} id={titleId}>
        {view.meta}
      </p>
      {action.kind === "invite" ? (
        <p className="font-display font-semibold text-xl tracking-[-0.02em]">
          {action.contractTitle}
        </p>
      ) : (
        <Money cents={action.amountCents} size="card" />
      )}
      {view.detail ? (
        <p className={cn("text-xs", muted)}>{view.detail}</p>
      ) : null}
      <div className="mt-auto flex flex-wrap gap-2 pt-2">
        {actionButtons(action).map((kind, index) => (
          <ActionButton
            action={action}
            busy={busy}
            key={kind}
            kind={kind}
            locale={locale}
            onRun={run}
            today={today}
            tryLock={tryLock}
            variant={buttonVariant(first, index)}
          />
        ))}
      </div>
    </article>
  );
}
