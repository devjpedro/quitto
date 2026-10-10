import { useEffect, useRef } from "react";
import { useMeQuery } from "@/hooks/use-me";
import { tourStore } from "../lib/tour-store";

/**
 * The first access: an account that never finished or skipped the tour
 * (`tourCompletedAt` null) sees it once. Only an explicit null counts, so an
 * old cache without the field never opens it. "Refazer" starts it by hand.
 */
export function useTourAutostart() {
  const { data } = useMeQuery();
  const started = useRef(false);
  const pending = data?.tourCompletedAt === null;
  useEffect(() => {
    if (pending && !started.current) {
      started.current = true;
      tourStore.start();
    }
  }, [pending]);
}
