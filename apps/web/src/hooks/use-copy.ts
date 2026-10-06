import { useCallback } from "react";
import { toast } from "sonner";

/** Copies a text and says so in a toast (the Pix code, a receipt or invite link). */
export function useCopy() {
  return useCallback(async (text: string, message: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(message);
  }, []);
}
