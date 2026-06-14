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
      <SheetPrimitive.Overlay className="data-[state=closed]:fade-out data-[state=open]:fade-in fixed inset-0 z-40 bg-foreground/30 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=open]:animate-in" />
      <SheetPrimitive.Content
        className={cn(
          "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col gap-5 border-border border-l bg-background p-4 shadow-2xl focus:outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=open]:duration-300 sm:p-6",
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between border-border/60 border-b pb-4">
          <SheetPrimitive.Title className="font-display font-semibold text-foreground text-lg tracking-tight">
            {title}
          </SheetPrimitive.Title>
          <SheetPrimitive.Close
            aria-label="Fechar"
            className="-mr-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X className="size-5" />
          </SheetPrimitive.Close>
        </div>
        {children}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
