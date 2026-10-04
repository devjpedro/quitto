// The home's lower part (mockups 12 and 13), shared by the content and its
// skeleton so the page keeps its shape when the home streams in. The rhythm is
// mockup 13's: 28 px between blocks on a phone, 32 px from md, and from
// lateral 36 px between blocks and 28 px between columns.

/** The lower part's own rhythm: 28/36 px above it (with the page's 16/20 px gap) and between its blocks. */
export const LOWER_STACK = "mt-3 flex flex-col gap-7 md:mt-4 md:gap-8";

/** A column of the lower part from lateral; below it, `contents` (its blocks join the page's single column). */
export const LOWER_COLUMN =
  "contents lateral:flex lateral:min-w-0 lateral:flex-col lateral:gap-9";

/**
 * The lower part with a side column: 3fr/2fr from lateral; from wide 2fr for
 * the list and 1fr per side block (the side column turns `contents` there).
 * auto-fit collapses the track of a side block that is not on screen, instead
 * of leaving a 300 px hole.
 */
export const LOWER_WITH_SIDE =
  "lateral:grid lateral:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)] lateral:items-start lateral:gap-x-7 lateral:gap-y-9 wide:grid-cols-[minmax(0,2fr)_repeat(auto-fit,minmax(300px,1fr))]";

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
