import { avatarColor } from "@/lib/avatar-color";
import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";

const SIZE = {
  sm: "size-6 text-[10px]",
  md: "size-7 text-[11px]",
} as const;

/**
 * The other party's face (DIRECAO › "Pessoas têm rosto"): initials on the
 * warm tone the name always gets. 24 px on a card or a row, 28 px on an
 * invite. Decorative: the name is in the text beside it. The user's own
 * avatar stays the light green one (layout/avatar.tsx).
 */
export function PersonAvatar({
  name,
  size = "sm",
}: {
  name: string;
  size?: keyof typeof SIZE;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-on-avatar leading-none tracking-[0.02em]",
        SIZE[size],
        avatarColor(name)
      )}
    >
      {initials(name)}
    </span>
  );
}
