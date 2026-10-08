import { Dialog, VisuallyHidden } from "radix-ui";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages.js";
import { PaletteCommands } from "./palette-commands";

/**
 * ⌘K, one tree for every width (planner's decision 13; spec §7: a different
 * structure belongs in an adaptive component of its own): a Radix Dialog that
 * is a panel at the top from 768 px (640 wide, 12vh down, a scrim behind) and
 * the whole screen below it, where "Cancelar" replaces the esc key. The
 * commands only exist while it is open.
 */
export function CommandPalette({
  onOpenChange,
  onOpenNotifications,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  onOpenNotifications: () => void;
  open: boolean;
}) {
  const [query, setQuery] = useState("");
  return (
    <Dialog.Root
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setQuery("");
        }
      }}
      open={open}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 max-md:hidden" />
        <Dialog.Content
          // The field says what the palette does: there is no description to point to.
          aria-describedby={undefined}
          className="palette-in fixed inset-0 z-50 flex flex-col bg-surface pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-ink focus:outline-none md:inset-x-auto md:top-[12vh] md:bottom-auto md:left-1/2 md:max-h-[min(560px,70vh)] md:w-[640px] md:max-w-[calc(100vw-48px)] md:-translate-x-1/2 md:rounded-panel md:p-0 md:shadow-float"
        >
          <VisuallyHidden.Root asChild>
            <Dialog.Title>{m.palette_label()}</Dialog.Title>
          </VisuallyHidden.Root>
          <PaletteCommands
            onOpenChange={onOpenChange}
            onOpenNotifications={onOpenNotifications}
            query={query}
            setQuery={setQuery}
          />
          {/* After the content, so it never takes the cursor from the field; on a
              phone it sits in the field's row (esc is for a keyboard). */}
          <Button
            className="absolute top-[env(safe-area-inset-top)] right-2 h-14 md:hidden"
            onClick={() => onOpenChange(false)}
            variant="ghost"
          >
            {m.palette_cancel()}
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
