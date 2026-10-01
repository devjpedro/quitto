import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;

export function DialogContent({
  className,
  children,
  title,
  description,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="data-[state=closed]:fade-out data-[state=open]:fade-in fixed inset-0 z-50 bg-[var(--scrim)] duration-[var(--dur-base)] ease-[var(--ease-out)] data-[state=closed]:animate-out data-[state=open]:animate-in" />
      <DialogPrimitive.Content
        className={cn(
          "data-[state=closed]:fade-out data-[state=open]:fade-in data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 material-overlay fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-2xl border border-border-strong p-6 shadow-[var(--shadow-lg)] duration-[var(--dur-base)] ease-[var(--ease-out)] focus:outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
          className
        )}
        {...props}
      >
        {/* `pr-10` reserva os 40px que o Fechar ocupava no cabeçalho (28px do
            botão + 16px de gap − 4px de recuo), então o título quebra de linha
            no mesmo ponto de antes em vez de correr por baixo do X. */}
        <div className="flex flex-col gap-1 pr-10">
          <DialogPrimitive.Title className="font-semibold text-foreground text-lg tracking-tight">
            {title}
          </DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="text-muted-foreground text-sm">
              {description}
            </DialogPrimitive.Description>
          ) : null}
        </div>
        {children}
        {/* O Fechar vem DEPOIS do `{children}` de propósito. O Radix foca o
            primeiro tabbable do content ao montar: com o Fechar no cabeçalho,
            todo diálogo que começa por campo de texto abria com o foco no X e
            perdia o que o usuário digitasse em seguida. Fora da ordem de tab, a
            leitura vira Título → conteúdo → Fechar. O `absolute` recoloca o
            botão no canto onde ele já estava (top-6/right-5 = p-6 − mr-1), então
            nada muda visualmente. */}
        <DialogPrimitive.Close
          aria-label="Fechar"
          className="absolute top-6 right-5 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <X className="size-5" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
