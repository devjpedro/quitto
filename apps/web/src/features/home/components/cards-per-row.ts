import { cn } from "@/lib/utils";

/**
 * How many action cards fit the desktop row (mockup 12): 3 from lg, 4 from
 * 2xl (1536 px) and 5 from wide (1840 px). The cards past the row hide by CSS
 * (pastTheRow) and "Ver todas (N)" shows while some card is hidden
 * (seeAllClasses): both read these numbers, so a tier changes in one place.
 * By class only, so the SSR and the hydration pass agree at any width.
 */
const ROW = { lg: 3, "2xl": 4, wide: 5 } as const;

/** Hides a card past the desktop row; every card stays in the HTML. */
export function pastTheRow(index: number): string | false {
  if (index === ROW.lg) {
    return "lg:hidden 2xl:block";
  }
  if (index === ROW["2xl"]) {
    return "lg:hidden wide:block";
  }
  return index >= ROW.wide && "lg:hidden";
}

/**
 * Where "Ver todas (N)" shows: from lg, while some card is past the row (N > 3
 * below 2xl, N > 4 below wide, N > 5 from wide). Null when every card always fits.
 */
export function seeAllClasses(count: number): string | null {
  if (count <= ROW.lg) {
    return null;
  }
  return cn(
    "hidden shrink-0 justify-end lg:flex",
    count <= ROW["2xl"] && "2xl:hidden",
    count <= ROW.wide && "wide:hidden"
  );
}
