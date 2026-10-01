import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light" as const, label: "Tema claro", Icon: Sun },
  { value: "dark" as const, label: "Tema escuro", Icon: Moon },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  return (
    // biome-ignore lint/a11y/useSemanticElements: segmented control para tema
    <div
      aria-label="Tema"
      className={cn(
        "inline-flex gap-0.5 rounded-md border border-border bg-accent p-0.5",
        className
      )}
      role="group"
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          aria-label={label}
          aria-pressed={theme === value}
          className={cn(
            "inline-grid size-7 place-items-center rounded-[7px] text-subtle-foreground transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            theme === value && "bg-card text-foreground shadow-xs"
          )}
          key={value}
          onClick={() => setTheme(value)}
          type="button"
        >
          <Icon aria-hidden="true" className="size-4" />
        </button>
      ))}
    </div>
  );
}
