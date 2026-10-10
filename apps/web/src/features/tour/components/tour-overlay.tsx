import { Plus } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Dialog } from "radix-ui";
import {
  type KeyboardEvent,
  useCallback,
  useLayoutEffect,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useSetTourCompleted } from "../api";
import {
  type Box,
  balloonPlacement,
  TOUR_STEPS,
  targetBox,
} from "../lib/tour-steps";
import { tourStore, useTourOpen } from "../lib/tour-store";

/** The viewport, read after the layout: the balloon and the spotlight follow the screen when it resizes or scrolls. */
function useStepBox(targets: string[]) {
  const [box, setBox] = useState<Box | null>(null);
  const [viewport, setViewport] = useState({ height: 0, width: 0 });
  const measure = useCallback(() => {
    setBox(targetBox(targets));
    setViewport({ height: window.innerHeight, width: window.innerWidth });
  }, [targets]);
  useLayoutEffect(() => {
    // A sidebar that scrolls can hide what the step explains: bring it in first.
    for (const target of targets) {
      const found = document.querySelector<HTMLElement>(
        `[data-tour="${target}"]`
      );
      found?.scrollIntoView?.({ block: "nearest" });
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure, targets]);
  return { box, viewport };
}

function Progress({ current }: { current: number }) {
  const total = TOUR_STEPS.length;
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-ink-muted text-xs tabular-nums">
        {m.tour_progress({ current, total })}
      </span>
      <span aria-hidden="true" className="flex flex-1 gap-1">
        {TOUR_STEPS.map((step, index) => (
          <span
            className={cn(
              "h-[3px] flex-1 rounded-full",
              index < current ? "bg-brand" : "bg-track"
            )}
            key={step.targets.join()}
          />
        ))}
      </span>
    </div>
  );
}

function TourDialog() {
  const [index, setIndex] = useState(0);
  const complete = useSetTourCompleted();
  const step = TOUR_STEPS[index] as (typeof TOUR_STEPS)[number];
  const last = index === TOUR_STEPS.length - 1;
  const { box, viewport } = useStepBox(step.targets);
  // The balloon's own height, so it never hangs off the bottom of a short window.
  const [height, setHeight] = useState(0);
  const place = balloonPlacement(box, viewport, height);

  function finish() {
    complete.mutate(true);
    tourStore.close();
  }
  const go = (delta: number) =>
    setIndex((i) => Math.min(TOUR_STEPS.length - 1, Math.max(0, i + delta)));
  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowRight" && !last) {
      go(1);
    } else if (event.key === "ArrowLeft") {
      go(-1);
    }
  }

  return (
    <Dialog.Root onOpenChange={(open) => (open ? null : finish())} open>
      <Dialog.Portal>
        {/* The dim: with a target the spotlight's shadow does it; the overlay only blocks the screen underneath. */}
        <Dialog.Overlay
          className={cn("fixed inset-0 z-[60]", !box && "bg-black/55")}
        />
        {box ? (
          <div
            aria-hidden="true"
            className="pointer-events-none fixed z-[60] rounded-control shadow-[0_0_0_9999px_rgb(0_0_0/0.55)] ring-2 ring-white ring-inset transition-[top,left,width,height] duration-200 motion-reduce:transition-none"
            style={{
              top: box.top,
              left: box.left,
              width: box.right - box.left,
              height: box.bottom - box.top,
            }}
          />
        ) : null}
        <Dialog.Content
          aria-describedby="tour-body"
          className="fixed z-[61] flex flex-col gap-2 rounded-card bg-surface p-4 text-ink shadow-float focus:outline-none"
          onKeyDown={onKeyDown}
          ref={(node) => {
            if (node) {
              setHeight(node.offsetHeight);
            }
          }}
          style={place}
        >
          <Progress current={index + 1} />
          <Dialog.Title className="mt-1 font-display font-semibold text-[19px] leading-tight tracking-[-0.02em]">
            {step.title()}
          </Dialog.Title>
          <Dialog.Description
            className="text-ink-muted text-sm leading-relaxed"
            id="tour-body"
          >
            {step.body()}
          </Dialog.Description>
          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              className="min-h-11 rounded-control px-1 text-ink-muted text-sm underline underline-offset-4 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand md:min-h-9"
              onClick={finish}
              type="button"
            >
              {last ? m.tour_finish() : m.tour_skip()}
            </button>
            <div className="flex gap-2">
              {index > 0 && !last ? (
                <Button onClick={() => go(-1)} size="sm" variant="inset">
                  {m.tour_back()}
                </Button>
              ) : null}
              {last ? (
                <Button asChild size="sm">
                  <Link onClick={finish} to="/contracts/new">
                    <Plus aria-hidden="true" size={14} weight="bold" />
                    {m.tour_create()}
                  </Link>
                </Button>
              ) : (
                <Button onClick={() => go(1)} size="sm">
                  {m.tour_next()}
                </Button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** The guided tour (mockup 20, B9), on top of the real screen: dims everything and cuts out what it explains. */
export function TourOverlay() {
  return useTourOpen() ? <TourDialog /> : null;
}
