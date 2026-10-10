import {
  CheckCircle,
  CircleNotch,
  Info,
  Warning,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { Toaster } from "sonner";
import { m } from "@/paraglide/messages.js";

const ICON = "size-5";

/**
 * Every toast gets these (sonner adds `classNames.default` to all of them too,
 * so per-type colors would race the surface in the stylesheet): an error
 * switches to danger-subtle through an attribute variant, which outranks it.
 */
const TOAST =
  "relative flex w-full items-start gap-2.5 rounded-card border border-line bg-surface-raised p-3.5 pr-12 font-sans text-ink text-sm shadow-float data-[type=error]:border-danger/30 data-[type=error]:bg-danger-subtle";

/**
 * The ✕ (sonner's `closeButton`): top right of the toast, 44 px to tap on a
 * phone and 32 from md. Sonner's own rules (specificity 0,2,0) paint the
 * button's colors even unstyled, so the ones here carry `!`.
 */
const CLOSE =
  "absolute! top-1 right-1 left-auto! flex size-11 items-center justify-center rounded-control border-0! bg-transparent! p-0 text-ink-muted! transition-colors hover:bg-surface-card! hover:text-ink! focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand md:size-8";

/**
 * The app's toasts on the redesign tokens (no `richColors`): a floating card
 * (card radius, thin line, the float shadow) with ink text and a Phosphor
 * icon, so a status never rests on color alone; errors sit on danger-subtle.
 * Bottom right from md, clear of the header's "+ Novo contrato"; below md
 * they sit above the tab bar and its safe area. In the wizard and the invite
 * the StepFrame publishes its action bar's height as --step-bottom, and a toast
 * sits above that bar too: on a phone it used to cover "Continuar", and while
 * the pointer rested on it the toast never timed out.
 */
export function AppToaster() {
  return (
    <Toaster
      className="[--app-toast-bottom:max(calc(env(safe-area-inset-bottom)_+_5.25rem),calc(var(--step-bottom,0px)_+_0.75rem))] md:[--app-toast-bottom:max(1.5rem,calc(var(--step-bottom,0px)_+_0.75rem))]"
      closeButton
      icons={{
        success: <CheckCircle className={`${ICON} text-brand`} />,
        info: <Info className={`${ICON} text-ink-muted`} />,
        close: <X aria-hidden="true" size={16} />,
        warning: <Warning className={`${ICON} text-warning`} />,
        error: <WarningCircle className={`${ICON} text-danger`} />,
        loading: (
          <CircleNotch
            className={`${ICON} animate-spin text-ink-muted motion-reduce:animate-none`}
          />
        ),
      }}
      mobileOffset={{
        bottom: "var(--app-toast-bottom)",
        left: "1rem",
        right: "1rem",
      }}
      offset={{ bottom: "var(--app-toast-bottom)", right: "1.5rem" }}
      position="bottom-right"
      toastOptions={{
        closeButtonAriaLabel: m.sheet_close(),
        unstyled: true,
        classNames: {
          toast: TOAST,
          closeButton: CLOSE,
          icon: "mt-px flex shrink-0",
          content: "flex min-w-0 flex-col gap-0.5",
          title: "font-medium",
          description: "text-ink-muted",
        },
      }}
    />
  );
}
