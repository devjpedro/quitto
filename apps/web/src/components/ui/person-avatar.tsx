import { avatarColor } from "@/lib/avatar-color";
import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";

const SIZE = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-7 text-[11px]",
  lg: "size-10 text-sm",
} as const;

/**
 * The other party's face (DIRECAO › "Pessoas têm rosto"): initials on the
 * warm tone the name always gets. 20 px in a suggestion pill, 24 px on a card or a row, 28 px on an
 * invite, 40 px on a contract. Decorative: the name is in the text beside it.
 * `self` is the user's own face, light green, as the shell's avatar.
 */
export function PersonAvatar({
  name,
  self = false,
  size = "sm",
}: {
  name: string;
  self?: boolean;
  size?: keyof typeof SIZE;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold leading-none tracking-[0.02em]",
        self
          ? "bg-brand-subtle text-brand"
          : cn("text-on-avatar", avatarColor(name)),
        SIZE[size]
      )}
    >
      {initials(name)}
    </span>
  );
}
