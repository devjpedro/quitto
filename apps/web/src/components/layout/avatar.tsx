import { Skeleton } from "@/components/ui/skeleton";
import { initials } from "@/lib/initials";
import type { SessionIdentity } from "@/lib/session-resolver";

export function Avatar({ identity }: { identity: SessionIdentity | null }) {
  if (!identity) {
    return <Skeleton className="size-8 rounded-full" />;
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-subtle font-semibold text-brand text-xs"
    >
      {initials(identity.name)}
    </span>
  );
}
