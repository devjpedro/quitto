import { Eye, EyeSlash } from "@phosphor-icons/react";
import { type ComponentProps, useState } from "react";
import { TextField } from "@/components/ui/field";
import { m } from "@/paraglide/messages.js";

/**
 * A password field with the eye: a 44 px button inside the box that shows or
 * hides what was typed. The text never leaves the input; the button names
 * what it will do and says whether it is on (`aria-pressed`).
 */
export function PasswordField(
  props: Omit<ComponentProps<typeof TextField>, "action" | "trailing" | "type">
) {
  const [shown, setShown] = useState(false);
  return (
    <TextField
      {...props}
      action={
        <button
          aria-label={shown ? m.password_hide() : m.password_show()}
          aria-pressed={shown}
          className="flex size-11 items-center justify-center rounded-control text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          onClick={() => setShown((value) => !value)}
          type="button"
        >
          {shown ? (
            <EyeSlash aria-hidden="true" size={18} />
          ) : (
            <Eye aria-hidden="true" size={18} />
          )}
        </button>
      }
      type={shown ? "text" : "password"}
    />
  );
}
