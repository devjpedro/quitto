import { type ComponentProps, lazy, Suspense, useEffect } from "react";
import { prefetchWhenIdle } from "@/components/ui/motion-scope";
import { useEverTrue } from "@/hooks/use-ever-true";

const loadHost = () =>
  import("./installment-panel-host").then((mod) => ({
    default: mod.InstallmentPanelHost,
  }));
const Host = lazy(loadHost);

/**
 * The installment panel, loaded when a page first has an installment open (or
 * when the browser is idle): the panel is most of what a page weighs, and a
 * page opened without one never draws it.
 */
export function InstallmentPanelHost(props: ComponentProps<typeof Host>) {
  const wanted = useEverTrue(Boolean(props.route.installmentId));
  useEffect(() => prefetchWhenIdle(() => loadHost()), []);
  return wanted ? (
    <Suspense fallback={null}>
      <Host {...props} />
    </Suspense>
  ) : null;
}
