import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-bold font-display text-ink text-lg tracking-[-0.02em]",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="size-5 rounded-full bg-brand-surface"
      />
      quitto
    </span>
  );
}
