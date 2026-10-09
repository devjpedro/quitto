import { X } from "@phosphor-icons/react";
import {
  AnimatePresence,
  motion,
  type Transition,
  useDragControls,
  useReducedMotion,
} from "motion/react";
import { Dialog } from "radix-ui";
import {
  createContext,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useContext,
  useRef,
} from "react";
import { IconButton } from "@/components/ui/icon-button";
import { MD_UP, useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const SheetVariant = createContext<"side" | "bottom" | null>(null);

/** "side" or "bottom" inside a ResponsiveSheet, `null` outside one. */
export function useSheetVariant() {
  return useContext(SheetVariant);
}

/**
 * From md the side panel lives inside the white board (the sidebar's 232 px
 * column and the 12 px of canvas stay outside): this box is the board's, and
 * it clips what crosses its edge, so the panel comes in and goes out through
 * the board's border, never the window's.
 */
const BOARD_CLIP =
  "fixed z-40 top-3 right-[max(0.75rem,env(safe-area-inset-right))] bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[calc(232px+env(safe-area-inset-left))] overflow-hidden rounded-panel";
const DISMISS_OFFSET_PX = 120;
const DISMISS_VELOCITY = 500;
/** From md (the side panel; a phone keeps its 44 px targets): the column's filled 32 px square. */
export const FILLED_SQUARE =
  "md:size-8 md:bg-surface-card md:hover:bg-surface-card-hover";
/**
 * The close of a sheet whose controls are filled: on the phone too, a 44 px
 * square filled like the sheet's other buttons (mockup 14, E), never a bare
 * icon; from md, the 32 px square centred on the title row, with the arrows.
 */
const FILLED_CLOSE = "bg-surface-card hover:bg-surface-card-hover md:top-4";

const SPRING = { type: "spring", stiffness: 420, damping: 40 } as const;
const SIDE_TRANSITION = { duration: 0.28, ease: [0.32, 0.72, 0, 1] } as const;

/**
 * Variant and motion for the sheet. Dragging only exists on the bottom sheet
 * with motion allowed: every drag hook is gated on `canDrag`, because motion
 * fires onDragEnd for any started drag even when `drag` is false, so an
 * ungated header would dismiss a side panel.
 */
function useSheetMotion() {
  const isWide = useMediaQuery(MD_UP);
  const reduceMotion = useReducedMotion();
  const hiddenReduced = { opacity: 0 };
  const dragControls = useDragControls();
  const variant: "side" | "bottom" = isWide ? "side" : "bottom";
  // The side panel crosses the board's edge (the board clips it) and fades as
  // one piece: opacity and travel share the container and the timing. The
  // bottom sheet fades as it travels, so the way out is the way in.
  const offscreen = isWide ? { x: "100%", opacity: 0 } : { y: "100%" };
  let transition: Transition = SPRING;
  if (reduceMotion) {
    transition = { duration: 0.15 };
  } else if (isWide) {
    transition = SIDE_TRANSITION;
  }
  return {
    variant,
    dragControls,
    canDrag: variant === "bottom" && !reduceMotion,
    hidden: reduceMotion ? hiddenReduced : offscreen,
    shown: reduceMotion ? { opacity: 1 } : { x: 0, y: 0, opacity: 1 },
    exit: reduceMotion ? hiddenReduced : { ...offscreen, opacity: 0 },
    transition,
  };
}

/**
 * The sheet opens from state (the bell, a sidebar row), with no Dialog.Trigger,
 * so Radix has nothing to give the focus back to on close and drops it on
 * <body>. Remember what had the focus when it opened and return it there,
 * as long as it is still in the page (WCAG 2.4.3). When it left the page, or
 * nothing had it (the ⌘K palette closes as it opens the sheet), go to
 * `fallbackFocus`. `adjustReturnFocus` may swap the opener for another
 * target (the connected opener, or null, comes in). Without any, Radix's own
 * handling stays.
 */
function useReturnFocus(
  fallbackFocus?: () => HTMLElement | null,
  adjustReturnFocus?: (opener: HTMLElement | null) => HTMLElement | null,
  frame?: RefObject<HTMLElement | null>
) {
  const returnTo = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: (event: Event) => {
      const active = document.activeElement;
      returnTo.current =
        active instanceof HTMLElement && active !== document.body
          ? active
          : null;
      if (frame) {
        // The frame, not the first control: a ring on "↑" would say "press me".
        event.preventDefault();
        frame.current?.focus({ preventScroll: true });
      }
    },
    onCloseAutoFocus: (event: Event) => {
      const opener = returnTo.current;
      returnTo.current = null;
      const live = opener?.isConnected ? opener : null;
      const target = adjustReturnFocus
        ? (adjustReturnFocus(live) ?? fallbackFocus?.())
        : (live ?? fallbackFocus?.());
      if (target) {
        event.preventDefault();
        target.focus();
      }
    },
  };
}

function SheetHeading({
  actions,
  description,
  filled,
  leading,
  title,
}: {
  actions?: ReactNode;
  description?: string;
  /** Before the title: a person's face. */
  leading?: ReactNode;
  /** The close is the 32 px square: the actions sit 4 px from it, not 8. */
  filled: boolean;
  title: string;
}) {
  return (
    <div className="flex items-start gap-1 pt-2">
      {leading ? <div className="mr-3 shrink-0">{leading}</div> : null}
      <div className={cn("min-w-0 flex-1", !actions && "pr-10")}>
        <Dialog.Title className="font-semibold text-base">{title}</Dialog.Title>
        {description ? (
          <Dialog.Description className="text-ink-muted text-sm">
            {description}
          </Dialog.Description>
        ) : null}
      </div>
      {/* The actions sit left of the close button, which is absolute at right. */}
      {actions ? (
        <div
          className={cn(
            "flex shrink-0 items-center gap-1",
            filled ? "mr-10 md:mr-7" : "mr-10"
          )}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The frame's placement. viewport-fit=cover: the side panel stays off the
 * notch of a phone on its side (md+). The bottom sheet clears the home bar
 * itself, unless it has a footer: then the footer takes the safe area, and
 * adding it here too would leave it twice under the main action.
 */
function frameClass(variant: "side" | "bottom", hasFooter: boolean): string {
  if (variant === "side") {
    // Inside the board's clip (BOARD_CLIP), flush with its right edge.
    return "absolute inset-y-0 right-0 w-[420px] max-w-full rounded-panel pointer-events-auto";
  }
  return cn(
    "fixed inset-x-0 bottom-0 max-h-[91dvh] rounded-t-panel",
    !hasFooter && "pb-[env(safe-area-inset-bottom)]"
  );
}

/** The scrim covers the board from md (where the side panel lives), the window below. */
function scrimClass(variant: "side" | "bottom"): string {
  return cn(
    "bg-black/40",
    variant === "side" ? BOARD_CLIP : "fixed inset-0 z-40"
  );
}

/** The scrim fades with the same timing as the side panel. */
function scrimTransition(variant: "side" | "bottom") {
  return variant === "side" ? SIDE_TRANSITION : undefined;
}

/** The box that clips the side panel to the board; the bottom sheet needs none. */
function clipClass(variant: "side" | "bottom"): string {
  return variant === "side"
    ? cn(BOARD_CLIP, "pointer-events-none z-50")
    : "contents";
}

/** Side panel from md up, draggable bottom sheet below. Same content in both. */
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  description,
  adjustReturnFocus,
  focusFrame = false,
  fallbackFocus,
  filledControls = false,
  footer,
  headerActions,
  leading,
  onKeyDown,
  children,
}: {
  /** The frame takes the focus on open (no ring on the first control); the keys and the screen reader still start inside the dialog. */
  focusFrame?: boolean;
  /** Swaps where the focus goes on close: gets what opened the sheet (if still in the page) and answers the target (null: the fallback). */
  adjustReturnFocus?: (opener: HTMLElement | null) => HTMLElement | null;
  children: ReactNode;
  description?: string;
  /** Where the focus goes on close when what had it at open left the page, or nothing had it. */
  fallbackFocus?: () => HTMLElement | null;
  /** The close button is filled, not a bare icon: a 44 px square on the phone, and from md the column's 32 px square (like `headerActions`). */
  filledControls?: boolean;
  /** Bottom sheet only: pinned under the scrolling body. */
  footer?: ReactNode;
  /** Side panel only: to the left of the close button. */
  headerActions?: ReactNode;
  /** Before the title in the header (a person's avatar). */
  leading?: ReactNode;
  /** On the element that stays mounted while open, so a panel can listen to the keys without remounting. */
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) {
  const { variant, canDrag, hidden, exit, shown, transition, dragControls } =
    useSheetMotion();
  const frameRef = useRef<HTMLDivElement>(null);
  const { onOpenAutoFocus, onCloseAutoFocus } = useReturnFocus(
    fallbackFocus,
    adjustReturnFocus,
    focusFrame ? frameRef : undefined
  );

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                animate={{ opacity: 1 }}
                className={scrimClass(variant)}
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                transition={scrimTransition(variant)}
              />
            </Dialog.Overlay>
            <div className={clipClass(variant)}>
              <Dialog.Content
                asChild
                forceMount
                onCloseAutoFocus={onCloseAutoFocus}
                onOpenAutoFocus={onOpenAutoFocus}
                {...(description ? {} : { "aria-describedby": undefined })}
              >
                <motion.div
                  animate={shown}
                  className={cn(
                    "z-50 flex flex-col bg-surface text-ink shadow-float focus:outline-none",
                    frameClass(variant, Boolean(footer))
                  )}
                  data-variant={variant}
                  drag={canDrag ? "y" : false}
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragControls={canDrag ? dragControls : undefined}
                  dragElastic={{ top: 0, bottom: 0.6 }}
                  dragListener={false}
                  exit={exit}
                  initial={hidden}
                  onDragEnd={(_, info) => {
                    if (!canDrag) {
                      return;
                    }
                    if (
                      info.offset.y > DISMISS_OFFSET_PX ||
                      info.velocity.y > DISMISS_VELOCITY
                    ) {
                      onOpenChange(false);
                    }
                  }}
                  onKeyDown={onKeyDown}
                  ref={frameRef}
                  tabIndex={-1}
                  transition={transition}
                >
                  <div
                    className={cn("px-5 pt-2", canDrag && "touch-none")}
                    onPointerDown={
                      canDrag ? (event) => dragControls.start(event) : undefined
                    }
                  >
                    {variant === "bottom" ? (
                      <div
                        aria-hidden="true"
                        className="mx-auto mb-2 h-1 w-9 rounded-full bg-line-strong"
                      />
                    ) : null}
                    <SheetHeading
                      actions={variant === "side" ? headerActions : undefined}
                      description={description}
                      filled={filledControls}
                      leading={leading}
                      title={title}
                    />
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-3 pb-5">
                    <SheetVariant.Provider value={variant}>
                      {children}
                    </SheetVariant.Provider>
                  </div>
                  {variant === "bottom" && footer ? (
                    // Pinned under the scrolling body (mockup 14, frame E): the
                    // main action never scrolls away. No radius here, so a
                    // straight top line is fine.
                    <div className="shrink-0 border-line border-t bg-surface px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                      {footer}
                    </div>
                  ) : null}
                  {/* Close comes AFTER the content: Radix focuses the first tabbable
                    element on open, and it must be the content, not "Close". */}
                  <Dialog.Close asChild>
                    <IconButton
                      className={cn(
                        "absolute top-3 right-3",
                        filledControls && cn(FILLED_CLOSE, FILLED_SQUARE)
                      )}
                      icon={X}
                      label={m.sheet_close()}
                    />
                  </Dialog.Close>
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
