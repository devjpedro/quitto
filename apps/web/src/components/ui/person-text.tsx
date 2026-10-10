import { cn } from "@/lib/utils";

/** The person's line with the name in bold; the message puts the name in verbatim. */
export function PersonText({
  line,
  strong,
  wrap = false,
}: {
  line: { name: string | null; text: string };
  strong: string;
  wrap?: boolean;
}) {
  const at = line.name ? line.text.indexOf(line.name) : -1;
  const fit = wrap ? "min-w-0" : "min-w-0 truncate";
  if (!line.name || at < 0) {
    return <span className={fit}>{line.text}</span>;
  }
  return (
    <span className={fit}>
      {line.text.slice(0, at)}
      <b className={cn("font-medium", strong)}>{line.name}</b>
      {line.text.slice(at + line.name.length)}
    </span>
  );
}
