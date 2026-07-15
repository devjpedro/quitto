import { Eye, EyeOff } from "lucide-react";
import { type ComponentProps, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Password field with a show/hide toggle. Mirrors the DateField calendar-toggle pattern. */
export function PasswordInput({
  className,
  ...props
}: ComponentProps<"input">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        className={cn("pr-10", className)}
        type={visible ? "text" : "password"}
        {...props}
      />
      <button
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        // size-6 (24px) atende o alvo mínimo do WCAG 2.2 AA (target-size)
        className="absolute inset-y-0 right-1.5 my-auto flex size-6 items-center justify-center rounded-sm text-muted-foreground opacity-70 transition-[opacity,transform] duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-90"
        onClick={() => setVisible((v) => !v)}
        type="button"
      >
        {visible ? (
          <EyeOff aria-hidden="true" className="size-4" />
        ) : (
          <Eye aria-hidden="true" className="size-4" />
        )}
      </button>
    </div>
  );
}
