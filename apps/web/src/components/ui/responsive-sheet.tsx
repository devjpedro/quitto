import { X } from "@phosphor-icons/react";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
} from "motion/react";
import { Dialog } from "radix-ui";
import { type ReactNode, useRef } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { MD_UP, useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const DISMISS_OFFSET_PX = 120;
const DISMISS_VELOCITY = 500;
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
  const variant = isWide ? "side" : "bottom";
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
 * as long as it is still in the page (WCAG 2.4.3). Without a live target,
 * Radix's own handling stays.
 */
function useReturnFocus() {
  const returnTo = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: () => {
      const active = document.activeElement;
      returnTo.current =
        active instanceof HTMLElement && active !== document.body
          ? active
          : null;
    },
    onCloseAutoFocus: (event: Event) => {
      const target = returnTo.current;
      returnTo.current = null;
      if (target?.isConnected) {
        event.preventDefault();
        target.focus();
      }
    },
  };
}

/** Side panel from md up, draggable bottom sheet below. Same content in both. */
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  children: ReactNode;
  description?: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) {
  const { variant, canDrag, hidden, shown, transition, dragControls } =
    useSheetMotion();
  const { onOpenAutoFocus, onCloseAutoFocus } = useReturnFocus();

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
                  variant === "side"
                    ? "inset-y-3 right-3 w-[420px] max-w-[calc(100vw-1.5rem)] rounded-panel"
                    : "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-panel pb-[env(safe-area-inset-bottom)]"
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
                  <div className="pt-2 pr-10">
                    <Dialog.Title className="font-semibold text-base">
                      {title}
                    </Dialog.Title>
                    {description ? (
                      <Dialog.Description className="text-ink-muted text-sm">
                        {description}
                      </Dialog.Description>
                    ) : null}
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-3 pb-5">
                  {children}
                </div>
                {/* Close comes AFTER the content: Radix focuses the first tabbable
                    element on open, and it must be the content, not "Close". */}
                <Dialog.Close asChild>
                  <IconButton
                    className="absolute top-3 right-3"
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
