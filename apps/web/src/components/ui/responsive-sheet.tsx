import { X } from "@phosphor-icons/react";
import {
  AnimatePresence,
  motion,
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

const DISMISS_OFFSET_PX = 120;
const DISMISS_VELOCITY = 500;
/** From md (the side panel; a phone keeps its 44 px targets): the column's filled 32 px square. */
export const FILLED_SQUARE =
  "md:size-8 md:bg-surface-card md:hover:bg-surface-card-hover";
/** The close of a sheet whose controls are filled: centred on the title row, with the arrows. */
const FILLED_CLOSE_AT = "md:top-4";

const SPRING = { type: "spring", stiffness: 420, damping: 40 } as const;

/**
 * Variant and motion for the sheet. Dragging only exists on the bottom sheet
 * with motion allowed: every drag hook is gated on `canDrag`, because motion
 * fires onDragEnd for any started drag even when `drag` is false, so an
 * ungated header would dismiss a side panel.
 */
function useSheetMotion() {
  const isWide = useMediaQuery(MD_UP);
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();
  const variant: "side" | "bottom" = isWide ? "side" : "bottom";
  const offscreen = isWide ? { x: "100%" } : { y: "100%" };
  return {
    variant,
    dragControls,
    canDrag: variant === "bottom" && !reduceMotion,
    hidden: reduceMotion ? { opacity: 0 } : offscreen,
    shown: reduceMotion ? { opacity: 1 } : { x: 0, y: 0 },
    transition: reduceMotion ? { duration: 0.15 } : SPRING,
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
  title,
}: {
  actions?: ReactNode;
  description?: string;
  /** The close is the 32 px square: the actions sit 4 px from it, not 8. */
  filled: boolean;
  title: string;
}) {
  return (
    <div className="flex items-start gap-1 pt-2">
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
    return "top-3 right-[max(0.75rem,env(safe-area-inset-right))] bottom-[max(0.75rem,env(safe-area-inset-bottom))] w-[420px] max-w-[calc(100vw-1.5rem)] rounded-panel";
  }
  return cn(
    "inset-x-0 bottom-0 max-h-[91dvh] rounded-t-panel",
    !hasFooter && "pb-[env(safe-area-inset-bottom)]"
  );
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
  /** Side panel only: the close button (like `headerActions`) is a filled 32 px square, as the column's, not a bare icon. */
  filledControls?: boolean;
  /** Bottom sheet only: pinned under the scrolling body. */
  footer?: ReactNode;
  /** Side panel only: to the left of the close button. */
  headerActions?: ReactNode;
  /** On the element that stays mounted while open, so a panel can listen to the keys without remounting. */
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) {
  const { variant, canDrag, hidden, shown, transition, dragControls } =
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
                className="fixed inset-0 z-40 bg-black/40"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
              />
            </Dialog.Overlay>
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
                  "fixed z-50 flex flex-col bg-surface text-ink shadow-float focus:outline-none",
                  frameClass(variant, Boolean(footer))
                )}
                data-variant={variant}
                drag={canDrag ? "y" : false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragControls={canDrag ? dragControls : undefined}
                dragElastic={{ top: 0, bottom: 0.6 }}
                dragListener={false}
                exit={hidden}
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
                      filledControls && cn(FILLED_SQUARE, FILLED_CLOSE_AT)
                    )}
                    icon={X}
                    label={m.sheet_close()}
                  />
                </Dialog.Close>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
