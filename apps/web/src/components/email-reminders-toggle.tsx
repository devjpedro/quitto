import { useId } from "react";
import { useUpdateEmailRemindersMutation } from "@/hooks/use-email-reminders";
import { cn } from "@/lib/utils";

export function EmailRemindersToggle({ checked }: { checked: boolean }) {
  const mutation = useUpdateEmailRemindersMutation();
  const labelId = useId();
  const descId = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <span className="font-medium text-foreground text-sm" id={labelId}>
          Receber lembretes de parcelas por e-mail
        </span>
        <span className="text-muted-foreground text-sm" id={descId}>
          Um e-mail por dia quando uma parcela estiver para vencer (3 dias
          antes) ou vencida.
        </span>
      </div>
      <button
        aria-checked={checked}
        aria-describedby={descId}
        aria-labelledby={labelId}
        className={cn(
          "relative inline-flex h-11 w-16 shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
          checked ? "bg-primary" : "bg-muted"
        )}
        disabled={mutation.isPending}
        onClick={() => mutation.mutate(!checked)}
        role="switch"
        type="button"
      >
        <span
          aria-hidden="true"
          className={cn(
            "size-7 rounded-full bg-card shadow-sm ring-1 ring-border transition-transform",
            checked ? "translate-x-7" : "translate-x-0"
          )}
        />
      </button>
    </div>
  );
}
