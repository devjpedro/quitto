import { ArrowUp } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { m } from "@/paraglide/messages.js";

/**
 * "Voltar ao topo" for the panel that scrolls inside the screen (from md,
 * mockup 20, B3): it shows after a screen of scroll, bottom right of the
 * panel, and takes the panel back to its top. Not on a phone, where the page
 * itself scrolls.
 */
export function BackToTop({ target }: { target: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const panel = document.getElementById(target);
    if (!panel) {
      return;
    }
    const update = () => setVisible(panel.scrollTop > panel.clientHeight);
    panel.addEventListener("scroll", update, { passive: true });
    return () => panel.removeEventListener("scroll", update);
  }, [target]);
  if (!visible) {
    return null;
  }
  return (
    <button
      className="fixed right-8 bottom-8 z-30 hidden h-11 items-center gap-2 rounded-control bg-surface px-4 font-medium text-ink text-sm shadow-float transition-colors hover:bg-surface-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand md:flex"
      onClick={() => {
        const panel = document.getElementById(target);
        const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
        panel?.scrollTo({ top: 0, behavior: calm.matches ? "auto" : "smooth" });
        setVisible(false);
        panel?.focus({ preventScroll: true });
      }}
      type="button"
    >
      <ArrowUp aria-hidden="true" size={16} />
      {m.back_to_top()}
    </button>
  );
}
