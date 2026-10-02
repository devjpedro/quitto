import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { overwriteGetLocale } from "@/paraglide/runtime.js";

// jsdom reports navigator.language = "en-US"; the app's base locale is pt-BR,
// and component tests assert pt-BR copy unless they opt into another locale.
overwriteGetLocale(() => "pt-BR");

const noop = () => undefined;

// --- Polyfills de jsdom exigidos pela paleta de comandos ---------------------
// O jsdom não implementa nada disto, e sem os três QUALQUER teste que monte o
// `cmdk` quebra por ReferenceError/TypeError antes de chegar na asserção:
//   - `ResizeObserver`: o `CommandList` observa a própria altura (`--cmdk-list-height`).
//   - `Element.prototype.scrollIntoView`: o `cmdk` rola até o item selecionado.
//   - `window.matchMedia`: o `useIsDesktop` escolhe Dialog (sm+) ou Sheet.

class ResizeObserverStub {
  observe = noop;
  unobserve = noop;
  disconnect = noop;
}

const globalWithRO = globalThis as {
  ResizeObserver?: typeof ResizeObserver;
};
globalWithRO.ResizeObserver ??= ResizeObserverStub;

const elementProto = Element.prototype as unknown as {
  scrollIntoView?: () => void;
};
elementProto.scrollIntoView ??= noop;

/** Só `(min-width: Npx)` — o único formato que o app usa. */
const MIN_WIDTH_RE = /\(min-width:\s*(\d+)px\)/;

const windowWithMQ = window as unknown as {
  matchMedia?: (query: string) => MediaQueryList;
};
windowWithMQ.matchMedia ??= (query: string) => {
  const minWidth = MIN_WIDTH_RE.exec(query);
  // Sem engine de CSS no jsdom: resolvemos a query contra o `innerWidth`
  // (1024 por padrão), então um teste consegue simular mobile mexendo nele.
  const matches = minWidth ? window.innerWidth >= Number(minWidth[1]) : false;
  return {
    matches,
    media: query,
    onchange: null,
    addEventListener: noop,
    removeEventListener: noop,
    addListener: noop,
    removeListener: noop,
    dispatchEvent: () => false,
  } as MediaQueryList;
};

afterEach(() => {
  cleanup();
});
