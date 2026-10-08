import { Compass } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages.js";
import { tourStore } from "../lib/tour-store";

/** "Fazer o tour": starts the guided tour over the screen the person is on (mockup 20, B9). */
export function TourButton({
  variant = "inset",
}: {
  variant?: "inset" | "onBrandOutline";
}) {
  return (
    <Button onClick={() => tourStore.start()} variant={variant}>
      <Compass aria-hidden="true" size={16} />
      {m.tour_start()}
    </Button>
  );
}
