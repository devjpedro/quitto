import { cn } from "@/lib/utils";

// The thumbnails show each theme as it is, whichever one the screen is in, so
// their colors are the themes' own values (tokens.css), not the page's tokens.
const PALETTE = {
  light: {
    canvas: "#E6E4DD",
    ink: "#111111",
    brand: "#1F5A32",
    line: "#D5D3CC",
    panel: "#FFFFFF",
    cell: "#F1F0EB",
  },
  dark: {
    canvas: "#121311",
    ink: "#ECEBE6",
    brand: "#7CC495",
    line: "#45463F",
    panel: "#242521",
    cell: "#2E2F2A",
  },
} as const;

/** The app in miniature: the sidebar on the canvas, and the panel with the card and its cells. */
export function ThemePicture({
  className,
  theme,
}: {
  className?: string;
  theme: keyof typeof PALETTE;
}) {
  const color = PALETTE[theme];
  return (
    <span
      className={cn("flex h-[78px] gap-2 rounded-control p-2", className)}
      style={{ background: color.canvas }}
    >
      <span className="flex w-[22%] flex-col gap-1 pt-0.5">
        <i
          className="h-1.5 w-3/4 rounded-sm"
          style={{ background: color.brand }}
        />
        <i className="h-[3px] rounded-sm" style={{ background: color.ink }} />
        <i className="h-[3px] rounded-sm" style={{ background: color.line }} />
        <i className="h-[3px] rounded-sm" style={{ background: color.line }} />
      </span>
      <span
        className="flex flex-1 flex-col gap-1.5 rounded-[5px] p-1.5"
        style={{ background: color.panel }}
      >
        <i className="h-3 rounded-[3px]" style={{ background: color.brand }} />
        <span className="flex gap-1">
          {[0, 1, 2].map((cell) => (
            <i
              className="h-3 flex-1 rounded-[3px]"
              key={cell}
              style={{ background: color.cell }}
            />
          ))}
        </span>
      </span>
    </span>
  );
}
