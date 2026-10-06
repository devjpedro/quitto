import { useCallback } from "react";
import { toast } from "sonner";
import { m } from "@/paraglide/messages.js";

/** Copies a text and says so in a toast (the Pix code, a receipt or invite link). */
export function useCopy() {
  return useCallback(async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // An insecure context or a refused permission: say so instead of nothing.
      toast.error(m.common_copy_failed());
      return;
    }
    toast.success(message);
  }, []);
}
