import {
  CheckCircle,
  CircleNotch,
  Info,
  Warning,
  WarningCircle,
} from "@phosphor-icons/react";
import { Toaster } from "sonner";

const ICON = "size-5";

/**
 * Every toast gets these (sonner adds `classNames.default` to all of them too,
 * so per-type colors would race the surface in the stylesheet): an error
 * switches to danger-subtle through an attribute variant, which outranks it.
 */
const TOAST =
  "flex w-full items-start gap-2.5 rounded-card border border-line bg-surface-raised p-3.5 font-sans text-ink text-sm shadow-float data-[type=error]:border-danger/30 data-[type=error]:bg-danger-subtle";

/**
 * The app's toasts on the redesign tokens (no `richColors`): a floating card
 * (card radius, thin line, the float shadow) with ink text and a Phosphor
 * icon, so a status never rests on color alone; errors sit on danger-subtle.
 * Bottom right from md, clear of the header's "+ Novo contrato"; below md
 * they sit above the tab bar and its safe area.
 */
export function AppToaster() {
  return (
    <Toaster
      className="[--app-toast-bottom:calc(env(safe-area-inset-bottom)_+_5.25rem)] md:[--app-toast-bottom:1.5rem]"
      icons={{
        success: <CheckCircle className={`${ICON} text-brand`} />,
        info: <Info className={`${ICON} text-ink-muted`} />,
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
        unstyled: true,
        classNames: {
          toast: TOAST,
          icon: "mt-px flex shrink-0",
          content: "flex min-w-0 flex-col gap-0.5",
          title: "font-medium",
          description: "text-ink-muted",
        },
      }}
    />
  );
}
