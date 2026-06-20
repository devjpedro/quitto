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
        className="absolute inset-y-0 right-2 my-auto flex size-5 items-center justify-center text-muted-foreground opacity-70 transition-opacity hover:opacity-100"
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
