import { m } from "@/paraglide/messages.js";

export interface TourStep {
  body: () => string;
  /** `data-tour` values to light up: the first one on screen of each. The balloon sits by their union. */
  targets: string[];
  title: () => string;
}

/** The tour's five steps (mockup 20, B9): they point at the shell, so any screen can host them. */
export const TOUR_STEPS: TourStep[] = [
  {
    targets: ["new-contract"],
    title: m.tour_step_contract_title,
    body: m.tour_step_contract_body,
  },
  {
    targets: ["nav-now"],
    title: m.tour_step_now_title,
    body: m.tour_step_now_body,
  },
  {
    targets: ["nav-contracts", "nav-installments"],
    title: m.tour_step_lists_title,
    body: m.tour_step_lists_body,
  },
  {
    targets: ["nav-people"],
    title: m.tour_step_people_title,
    body: m.tour_step_people_body,
  },
  {
    targets: ["notifications"],
    title: m.tour_step_bell_title,
    body: m.tour_step_bell_body,
  },
];

export interface Box {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

/** Safari before 17.4 has no checkVisibility: no client rects is the same "no box". */
function isRendered(el: HTMLElement): boolean {
  return el.checkVisibility?.() ?? el.getClientRects().length > 0;
}

/** The union of what the step lights up, or null when none of it is on screen (the balloon then sits in the middle). */
export function targetBox(targets: string[]): Box | null {
  const boxes: Box[] = [];
  for (const target of targets) {
    const found = Array.from(
      document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)
    ).find(isRendered);
    if (found) {
      const { bottom, left, right, top } = found.getBoundingClientRect();
      boxes.push({ bottom, left, right, top });
    }
  }
  if (boxes.length === 0) {
    return null;
  }
  return {
    top: Math.min(...boxes.map((b) => b.top)),
    left: Math.min(...boxes.map((b) => b.left)),
    right: Math.max(...boxes.map((b) => b.right)),
    bottom: Math.max(...boxes.map((b) => b.bottom)),
  };
}

const GAP = 14;
const MARGIN = 16;
export const BALLOON_WIDTH = 360;

/**
 * Where the balloon goes, as CSS offsets. From md it sits beside the target,
 * at its right (the sidebar's items); below md, above it (the tab bar) or
 * below it (the top bar's bell). Always inside the screen: `height` is the
 * balloon's own, measured, so a short window pulls it up instead of cutting it.
 */
export function balloonPlacement(
  box: Box | null,
  viewport: { height: number; width: number },
  height = 0
): { bottom?: number; left: number; top?: number; width: number } {
  const width = Math.min(BALLOON_WIDTH, viewport.width - MARGIN * 2);
  if (!box) {
    return {
      left: (viewport.width - width) / 2,
      top: Math.max(MARGIN, viewport.height / 2 - 100),
      width,
    };
  }
  const clampLeft = (left: number) =>
    Math.max(MARGIN, Math.min(left, viewport.width - width - MARGIN));
  if (viewport.width >= 768) {
    return {
      left: clampLeft(box.right + GAP),
      top: Math.max(
        MARGIN,
        Math.min(box.top - 8, viewport.height - height - MARGIN)
      ),
      width,
    };
  }
  if (box.top > viewport.height / 2) {
    return {
      left: clampLeft(box.left),
      bottom: viewport.height - box.top + GAP,
      width,
    };
  }
  return { left: clampLeft(box.left), top: box.bottom + GAP, width };
}
