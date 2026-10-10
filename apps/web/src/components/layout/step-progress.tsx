import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

/** The steps on a phone (mockup 15, E): "Passo 2 de 4 · Valores e datas" over 4 segments of 4 px. */
export function StepProgress({
  current,
  label,
  total,
}: {
  current: number;
  label: string;
  total: number;
}) {
  const segments = Array.from({ length: total }, (_, index) => index + 1);
  return (
    <div className="px-4 md:hidden">
      <p className="flex justify-between gap-3 text-[12.5px] text-ink-muted tabular-nums">
        <span>{m.wizard_step_of({ n: current, total })}</span>
        <b className="font-medium text-ink">{label}</b>
      </p>
      <div aria-hidden="true" className="mt-2 flex h-1 gap-1">
        {segments.map((segment) => (
          <span
            className={cn(
              "flex-1 rounded-full",
              segment <= current ? "bg-brand" : "bg-track"
            )}
            key={segment}
          />
        ))}
      </div>
    </div>
  );
}
