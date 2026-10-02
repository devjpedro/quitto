import { Command as CommandPrimitive, CommandRoot } from "cmdk";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// `CommandRoot` é a mesma raiz do `cmdk`, mas sem os subcomponentes estáticos
// no tipo — é assim que o `Command.Dialog` fica fora da nossa superfície. Quem
// monta o contêiner são os nossos `dialog.tsx` (desktop) e `sheet.tsx` (mobile).
export const Command = CommandRoot;

export function CommandInput({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex items-center gap-2 border-border border-b px-4">
      <CommandPrimitive.Input
        className={cn(
          "flex h-12 w-full bg-transparent text-base text-foreground outline-none placeholder:text-subtle-foreground disabled:opacity-50",
          className
        )}
        {...props}
      />
    </div>
  );
}

export function CommandList({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      className={cn(
        "scrollbar-thin max-h-[min(24rem,60vh)] overflow-y-auto overscroll-contain p-2",
        className
      )}
      {...props}
    />
  );
}

export function CommandEmpty({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      className={cn(
        "px-3 py-8 text-center text-muted-foreground text-sm",
        className
      )}
      {...props}
    />
  );
}

export function CommandGroup({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        "text-foreground [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-subtle-foreground [&_[cmdk-group-heading]]:text-xs",
        className
      )}
      {...props}
    />
  );
}

export function CommandItem({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        // `min-h-11` = 44px: alvo de toque do WCAG 2.2 AA, não estilo.
        "relative flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-sm outline-none transition-colors",
        "before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-primary before:opacity-0 before:transition-opacity",
        "data-[selected=true]:border-border-strong data-[selected=true]:bg-card data-[selected=true]:text-primary-strong data-[selected=true]:before:opacity-100",
        className
      )}
      {...props}
    />
  );
}

export function CommandShortcut({
  className,
  ...props
}: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "ml-auto rounded border border-border px-1.5 py-0.5 text-subtle-foreground text-xs",
        className
      )}
      {...props}
    />
  );
}
