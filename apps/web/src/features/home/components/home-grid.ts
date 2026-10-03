// The home's lower part (mockup 12), shared by the content and its skeleton so
// the page keeps its shape when the home streams in.

/** A column of the lower part from lateral; below it, `contents` (its blocks join the page's single column). */
export const LOWER_COLUMN =
  "contents lateral:flex lateral:min-w-0 lateral:flex-col lateral:gap-5";

/**
 * The lower part with a side column: 3fr/2fr from lateral; from wide 2fr for
 * the list and 1fr per side block (the side column turns `contents` there).
 * auto-fit collapses the track of a side block that is not on screen, instead
 * of leaving a 300 px hole.
 */
export const LOWER_WITH_SIDE =
  "lateral:grid lateral:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)] lateral:items-start lateral:gap-x-6 lateral:gap-y-5 wide:grid-cols-[minmax(0,2fr)_repeat(auto-fit,minmax(300px,1fr))]";
