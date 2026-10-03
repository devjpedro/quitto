/**
 * The milestone of the moment at the foot of the sidebar (mockups 02 and 08):
 * lime with dark text, never lime text on a light surface. Text only: the
 * shell layout picks and words it (features/home, through ShellProps).
 */
export function MomentCard({
  detail,
  title,
}: {
  detail: string;
  title: string;
}) {
  return (
    <div className="rounded-card bg-highlight px-3 py-2.5 text-on-highlight">
      <p className="font-semibold text-sm">{title}</p>
      <p className="text-xs">{detail}</p>
    </div>
  );
}
