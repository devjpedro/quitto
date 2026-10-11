import { detectPlatform } from "@/features/install/lib/platform";

const SAFARI_DESKTOP_RE = /^((?!chrome|chromium|android|crios|fxios).)*safari/i;

/** The receipt's PDF, the same file "Baixar PDF" saves. */
export function receiptPdfUrl(token: string, inline = false): string {
  return `/api/public/receipts/${token}/receipt.pdf${inline ? "?inline=1" : ""}`;
}

/**
 * Where an iframe cannot print a PDF (Safari, and every phone: iOS and
 * Android have no inline PDF in a frame), the system's viewer in a new tab
 * prints it instead.
 */
function opensInATab(): boolean {
  const platform = detectPlatform({
    maxTouchPoints: navigator.maxTouchPoints,
    platform: navigator.platform,
    userAgent: navigator.userAgent,
  });
  return (
    platform.kind !== "other" || SAFARI_DESKTOP_RE.test(navigator.userAgent)
  );
}

/**
 * "Imprimir": the API's PDF, not the page. On a computer it is fetched as a
 * blob, loaded in a hidden iframe and printed from there; anywhere that does
 * not work (or if it fails), the PDF opens in a new tab.
 */
export async function printReceiptPdf(token: string): Promise<void> {
  const inline = receiptPdfUrl(token, true);
  if (opensInATab()) {
    // Called straight from the tap: a popup opened after an await is blocked.
    window.open(inline, "_blank", "noopener");
    return;
  }
  try {
    const response = await fetch(receiptPdfUrl(token));
    if (!response.ok) {
      throw new Error(`receipt.pdf ${response.status}`);
    }
    const url = URL.createObjectURL(await response.blob());
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    const cleanup = () => {
      frame.remove();
      URL.revokeObjectURL(url);
    };
    frame.onload = () => {
      const view = frame.contentWindow;
      if (!view) {
        cleanup();
        window.open(inline, "_blank", "noopener");
        return;
      }
      view.addEventListener("afterprint", cleanup, { once: true });
      view.focus();
      view.print();
      // afterprint is not fired everywhere: do not keep the file for good.
      setTimeout(cleanup, 120_000);
    };
    frame.src = url;
    document.body.append(frame);
  } catch {
    window.open(inline, "_blank", "noopener");
  }
}
