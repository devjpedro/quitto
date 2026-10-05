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
 * Below the content width two buttons need side by side (the wider locale,
 * gap included), each takes a whole row: never one left alone (decision 16).
 * Most pairs fit in 240 px; below md a group's "Ver parcelas" is a 44 px icon.
 */
const STACK_BELOW: Record<string, string> = {
  "whatsapp,mark_received": "@max-[23rem]:w-full", // 362 px
  "whatsapp,see_installments": "@max-[15rem]:w-full md:@max-[21rem]:w-full", // 331 px
  "pay_oldest,see_installments": "@max-[15rem]:w-full md:@max-[17rem]:w-full", // 267 px
};

/**
 * One thing to do (mockup 13). The first card is the green "Faça primeiro";
 * the rest are filled with the warm card tone, never outlined (DIRECAO ›
 * Forma). Hover steps the fill down. A card too narrow for its two buttons
 * (1024 px, three per row; a phone for the longer pairs) stacks them full
 * width instead of leaving one alone on a row.
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
  const buttons = actionButtons(action);
  const stack = STACK_BELOW[buttons.join()] ?? "@max-[15rem]:w-full";
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
        {buttons.map((kind, index) => (
          <ActionButton
            action={action}
            busy={busy}
            className={stack}
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
