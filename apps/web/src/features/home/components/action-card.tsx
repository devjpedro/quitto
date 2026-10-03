import { useId } from "react";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/utils";
import { getLocale } from "@/paraglide/runtime.js";
import { useActionHandlers } from "../hooks/use-action-handlers";
import { actionButtons, describeAction } from "../lib/action-view";
import type { HomeAction } from "../types";
import { ActionButton, type CardButtonVariant } from "./action-button";
import { InstallmentBody, InviteBody } from "./action-card-parts";

function buttonVariant(first: boolean, index: number): CardButtonVariant {
  if (!first) {
    return "inset";
  }
  return index === 0 ? "onBrand" : "onBrandOutline";
}

/**
 * One thing to do (mockup 13). The first card is the green "Faça primeiro";
 * the rest are filled with the warm card tone, never outlined (DIRECAO ›
 * Forma). Hover steps the fill down. A narrow card (1024 px, three per row)
 * stacks its buttons full width instead of leaving one half a row.
 */
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
  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "@container flex h-full flex-col rounded-card px-[18px] pt-4 pb-[18px] transition-colors",
        first
          ? "bg-brand-surface text-on-brand hover:bg-brand-hover"
          : "bg-surface-card text-ink hover:bg-surface-card-hover"
      )}
    >
      <Tag tone={view.tone}>{view.tag}</Tag>
      {action.kind === "invite" ? (
        <InviteBody first={first} titleId={titleId} view={view} />
      ) : (
        <InstallmentBody
          action={action}
          first={first}
          titleId={titleId}
          view={view}
        />
      )}
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        {actionButtons(action).map((kind, index) => (
          <ActionButton
            action={action}
            busy={busy}
            className="@max-[15rem]:w-full"
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
