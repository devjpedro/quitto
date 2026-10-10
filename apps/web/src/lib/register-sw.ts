/**
 * Registers /sw.js in the production build only (never in dev: it would cache
 * Vite's modules), after `load` and when the browser is idle, so it stays out
 * of the Lighthouse run. To switch the PWA off, publish a sw.js that unregisters
 * itself (the recipe is at the top of public/sw.js) and drop this call.
 */
export function registerServiceWorker() {
  if (!(import.meta.env.PROD && "serviceWorker" in navigator)) {
    return;
  }
  const register = () => {
    const idle =
      window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1));
    idle(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    });
  };
  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register, { once: true });
  }
}
