import { PersonAvatar } from "@/components/ui/person-avatar";
import type { Person } from "@/features/people/types";
import { m } from "@/paraglide/messages.js";

/**
 * "Pessoas dos seus contratos": up to four people as pills with a face and the
 * first name (so the four fit one line and "Continuar" stays in the first
 * screen). Tapping one fills the name; the full name is in the button's name.
 */
export function PartySuggestions({
  onPick,
  people,
}: {
  onPick: (person: Person) => void;
  people: Person[];
}) {
  if (people.length === 0) {
    return null;
  }
  return (
    <fieldset className="min-w-0" data-testid="party-suggestions">
      <legend className="mb-1.5 p-0 text-[12px] text-ink-muted">
        {m.wizard_suggestions_label()}
      </legend>
      <div className="flex flex-wrap gap-2">
        {people.map((person) => (
          <button
            aria-label={m.wizard_suggestion_use({ name: person.name })}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-surface-card py-1 pr-3 pl-1.5 text-[13.5px] transition-colors hover:bg-surface-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand active:scale-[.97] motion-reduce:active:scale-100 md:h-9 md:min-h-0"
            data-testid="party-suggestion"
            key={person.key}
            onClick={() => onPick(person)}
            type="button"
          >
            <PersonAvatar name={person.name} size="xs" />
            {person.name.split(" ")[0]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
