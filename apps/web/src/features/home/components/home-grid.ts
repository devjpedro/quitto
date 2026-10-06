import { cn } from "@/lib/utils";

// The home's lower part (mockups 12 and 13), shared by the content and its
// skeleton so the page keeps its shape when the home streams in. The rhythm is
// mockup 13's: 28 px between blocks on a phone, 32 px from md, and from
// lateral 36 px between blocks and 28 px between columns.

/** The lower part's own rhythm: 28/36 px above it (with the page's 16/20 px gap) and between its blocks. */
export const LOWER_STACK = "mt-3 flex flex-col gap-7 md:mt-4 md:gap-8";

/** A column of the lower part from lateral; below it, `contents` (its blocks join the page's single column). */
export const LOWER_COLUMN =
  "contents lateral:flex lateral:min-w-0 lateral:flex-col lateral:gap-9";

/** LOWER_COLUMN for the content: a column with nothing to show from lateral is hidden there, so it adds no gap. */
export function lowerColumn(shows: boolean, className?: string): string {
  return cn(LOWER_COLUMN, className, !shows && "lateral:hidden");
}

/**
 * The lower part with a side column: 3fr/2fr from lateral, at every width
 * (from wide the actions go to 5 per row, but there are still two columns
 * down here). A side block that is not on screen leaves no track: the grid
 * only exists when the data says there is something to put in it.
 */
export const LOWER_WITH_SIDE =
  "lateral:grid lateral:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)] lateral:items-start lateral:gap-x-7 lateral:gap-y-9";

/**
 * The actions' row when they are few (mockup 13, frame E): from lateral the
 * action grid's own tracks (12 px apart, like the cards), so the cards keep
 * their width and "Próximos 30 dias" takes the free columns. Below lateral,
 * two blocks of the page's single column, 28 px apart on a phone and 36 px
 * from md: the same gap the actions keep from the lower part otherwise.
 */
export const FEW_ROW =
  "flex flex-col gap-7 md:gap-9 lateral:grid lateral:grid-cols-[minmax(0,1.25fr)_repeat(2,minmax(0,1fr))] lateral:items-start lateral:gap-3 2xl:grid-cols-[minmax(0,1.25fr)_repeat(3,minmax(0,1fr))] wide:grid-cols-[minmax(0,1.25fr)_repeat(4,minmax(0,1fr))]";

/** Tracks the cards and "Próximos 30 dias" take in that row: 3, 4 and 5 columns at lateral, 2xl and wide. */
export const FEW_SPANS: Record<1 | 2, { actions: string; upcoming: string }> = {
  1: {
    actions: "lateral:col-span-1",
    upcoming: "lateral:col-span-2 2xl:col-span-3 wide:col-span-4",
  },
  2: {
    actions: "lateral:col-span-2",
    upcoming: "lateral:col-span-1 2xl:col-span-2 wide:col-span-3",
  },
};

/** The lower part when the list went up: notifications (and the guide) left, milestones right, 3fr/2fr at every width from lateral. */
export const LOWER_FEW =
  "lateral:grid lateral:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)] lateral:items-start lateral:gap-x-7 lateral:gap-y-9";

/**
 * The lower part with few cards, always on that grid: a block alone takes the
 * 3fr track, never the whole width. With nothing to show from lateral it is
 * hidden there, so its margin leaves no gap at the end of the panel.
 */
export function lowerFew(shows: boolean): string {
  return cn(LOWER_STACK, LOWER_FEW, !shows && "lateral:hidden");
}
