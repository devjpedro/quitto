import type { Icon } from "@phosphor-icons/react";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function IconButton({
  label,
  icon: IconComponent,
  badge,
  asChild = false,
  className,
  children,
  ...props
}: Omit<ComponentProps<"button">, "aria-label"> & {
  asChild?: boolean;
  badge?: number;
  icon: Icon;
  /**
   * Accessible name. It overrides the button content, so when `badge` is set
   * the label must already carry the count (e.g. "Notificações, 3 não lidas").
   */
  label: string;
}) {
  const Comp = asChild ? Slot.Root : "button";
  const content = (
    <>
      <IconComponent aria-hidden="true" size={20} />
      {badge && badge > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-danger px-1 font-medium text-[10px] text-ink-inverse tabular-nums leading-4"
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </>
  );
  return (
    <Comp
      aria-label={label}
      className={cn(
        "relative inline-flex size-11 shrink-0 items-center justify-center rounded-control text-ink transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand active:scale-[.97] motion-reduce:active:scale-100 md:size-9",
        className
      )}
      type={asChild ? undefined : "button"}
      {...props}
    >
      {asChild ? <Slot.Slottable>{children}</Slot.Slottable> : content}
      {asChild ? content : null}
    </Comp>
  );
}
