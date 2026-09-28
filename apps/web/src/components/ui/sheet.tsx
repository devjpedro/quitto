import { X } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;

export function SheetContent({
  className,
  children,
  title,
  ...props
}: ComponentProps<typeof SheetPrimitive.Content> & {
  title: string;
  children: ReactNode;
}) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="data-[state=closed]:fade-out data-[state=open]:fade-in fixed inset-0 z-40 bg-[var(--scrim)] duration-[var(--dur-base)] ease-[var(--ease-out)] data-[state=closed]:animate-out data-[state=open]:animate-in" />
      <SheetPrimitive.Content
        className={cn(
          "data-[state=closed]:fade-out data-[state=open]:fade-in data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right material-overlay fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col gap-5 border-border-strong border-l p-4 shadow-[var(--shadow-lg)] duration-[var(--dur-slow)] ease-[var(--ease-out)] focus:outline-none data-[state=closed]:animate-out data-[state=open]:animate-in sm:p-6",
          className
        )}
        {...props}
      >
        {/* `pr-6` reserva os 24px que o Fechar ocupava na linha do cabeçalho
            (28px do botão − 4px de recuo), então o título quebra no mesmo ponto
            de antes em vez de correr por baixo do X. */}
        <div className="border-border/60 border-b pr-6 pb-4">
          <SheetPrimitive.Title className="font-semibold text-foreground text-lg tracking-tight">
            {title}
          </SheetPrimitive.Title>
        </div>
        {children}
        {/* Mesmo motivo do `dialog.tsx`: o Fechar depois do `{children}` sai do
            começo da ordem de tab, então o Radix foca o primeiro campo do
            conteúdo em vez do X. `absolute` devolve o botão ao canto de antes
            (top/right = padding − mr-1, nos dois breakpoints do `p-4 sm:p-6`). */}
        <SheetPrimitive.Close
          aria-label="Fechar"
          className="absolute top-4 right-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:top-6 sm:right-5"
        >
          <X className="size-5" />
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
