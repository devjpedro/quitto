import type { Icon } from "@phosphor-icons/react";
import { DropdownMenu } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A floating menu (mockup 14: Exportar and "⋯"): white, the float shadow,
 * 14 px corners; the highlighted item steps to surface-card. Radix moves the
 * focus in, closes on Esc and gives it back to the trigger.
 */
export function Menu({
  align = "end",
  children,
  label,
  trigger,
}: {
  align?: "start" | "end";
  children: ReactNode;
  label: string;
  trigger: ReactNode;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          aria-label={label}
          className="z-50 min-w-[236px] rounded-card bg-surface p-1.5 text-ink shadow-float ring-1 ring-ink/6"
          sideOffset={6}
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function MenuItem({
  asChild = false,
  children,
  icon: IconComponent,
  onSelect,
  tone,
}: {
  asChild?: boolean;
  children: ReactNode;
  icon?: Icon;
  onSelect?: () => void;
  tone?: "danger";
}) {
  return (
    <DropdownMenu.Item
      asChild={asChild}
      className={cn(
        "flex h-11 cursor-pointer select-none items-center gap-2.5 rounded-control px-2.5 text-sm outline-none data-[highlighted]:bg-surface-card md:h-10",
        tone === "danger" ? "text-danger" : "text-ink"
      )}
      onSelect={onSelect}
    >
      {asChild ? (
        children
      ) : (
        <>
          {IconComponent ? (
            <IconComponent
              aria-hidden="true"
              className={tone === "danger" ? "text-danger" : "text-ink-muted"}
              size={18}
            />
          ) : null}
          {children}
        </>
      )}
    </DropdownMenu.Item>
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="mx-1.5 my-1 h-px bg-divider" />;
}
