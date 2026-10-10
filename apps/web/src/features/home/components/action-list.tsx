import type { KeyboardEvent } from "react";
import { useActionLock } from "@/hooks/use-action-lock";
import { m } from "@/paraglide/messages.js";
import { useActionFocus } from "../hooks/use-action-focus";
import type { HomeAction } from "../types";
import { ActionCard } from "./action-card";

/**
 * A held Enter or Space repeats its keydown, and every repeat would activate
 * the button that has the focus by then: the first button of the card that
 * took the place of the one just acted on, once the 700 ms lock is over.
 * Cancelling the repeated keydown cancels that activation: only the first
 * press acts.
 */
function swallowKeyRepeat(event: KeyboardEvent) {
  if (event.repeat && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
  }
}

/**
 * The action in the spotlight (mockup 20, B1): one green "Faça primeiro" card.
 * The rest of the actions are "Na sequência" (NextInLine). Acting on it takes
 * it out at once, the next one takes its place, and the focus goes to it.
 */
export function ActionList({
  actions,
  today,
}: {
  /** Only the first one is drawn. */
  actions: HomeAction[];
  today: string;
}) {
  const first = actions.slice(0, 1);
  const tryLock = useActionLock();
  const { sectionRef, onActionStart } = useActionFocus(first);
  return (
    <section
      aria-label={m.home_actions_title()}
      className="focus:outline-none"
      onKeyDownCapture={swallowKeyRepeat}
      ref={sectionRef}
    >
      <ul>
        {first.map((action) => (
          <li key={action.id}>
            <ActionCard
              action={action}
              first
              onActionStart={onActionStart}
              today={today}
              tryLock={tryLock}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
