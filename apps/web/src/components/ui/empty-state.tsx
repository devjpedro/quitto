import type { Icon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Dashed outline in the shape of the real component that will fill the space. */
export function GhostCard({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex flex-col gap-2 rounded-card border-[1.5px] border-line-strong border-dashed p-4",
        className
      )}
    >
      {children ?? (
        <>
          <GhostLine height="16px" width="64px" />
          <GhostLine width="55%" />
          <GhostLine height="20px" width="30%" />
          <GhostLine height="6px" width="100%" />
        </>
      )}
    </div>
  );
}

export function GhostLine({
  width,
  height = "9px",
}: {
  height?: string;
  width: string;
}) {
  return (
    <span
      className="block rounded-full bg-surface-sunken"
      style={{ width, height }}
    />
  );
}

export function EmptyState({
  icon: IconComponent,
  title,
  description,
  action,
  preview,
  variant = "full",
}: {
  action?: ReactNode;
  description: string;
  icon: Icon;
  preview?: ReactNode;
  title: string;
  variant?: "full" | "compact";
}) {
  if (variant === "compact") {
    return (
      <div className="flex flex-col gap-1.5 rounded-card border border-line p-4">
        <IconComponent aria-hidden="true" className="text-brand" size={22} />
        <h3 className="font-semibold text-ink text-sm">{title}</h3>
        <p className="text-ink-muted text-sm leading-relaxed">{description}</p>
        {action ? <div className="mt-1">{action}</div> : null}
      </div>
    );
  }
  return (
    <div className="grid items-center gap-6 md:grid-cols-2">
      {preview ? <div className="grid gap-2">{preview}</div> : null}
      <div className="flex flex-col gap-2">
        <IconComponent aria-hidden="true" className="text-brand" size={24} />
        <h3 className="font-display font-semibold text-ink text-xl tracking-[-0.02em]">
          {title}
        </h3>
        <p className="max-w-sm text-ink-muted text-sm leading-relaxed">
          {description}
        </p>
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}
