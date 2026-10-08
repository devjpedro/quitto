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
//   - `window.matchMedia`: hooks de largura (`useMediaQuery`).

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

// jsdom defines `window.scrollTo` only to log "Not implemented" on every call
// (sheets and dialogs lock the scroll); `??=` would keep that stub.
window.scrollTo = noop as typeof window.scrollTo;

/** `(min-width: Npx)` or `(min-width: Nrem)`: the two forms the app uses. */
const MIN_WIDTH_RE = /\(min-width:\s*([\d.]+)(px|rem)\)/;

/** In a media query rem is the browser's initial font size: 16 px in jsdom. */
const ROOT_FONT_PX = 16;

const windowWithMQ = window as unknown as {
  matchMedia?: (query: string) => MediaQueryList;
};
windowWithMQ.matchMedia ??= (query: string) => {
  const minWidth = MIN_WIDTH_RE.exec(query);
  // Sem engine de CSS no jsdom: resolvemos a query contra o `innerWidth`
  // (1024 por padrão), então um teste consegue simular mobile mexendo nele.
  const minPx =
    minWidth &&
    Number(minWidth[1]) * (minWidth[2] === "rem" ? ROOT_FONT_PX : 1);
  const matches = minPx ? window.innerWidth >= minPx : false;
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

// jsdom has no `checkVisibility` and no layout: an element counts as rendered
// unless it or an ancestor is display none (a test sets it inline, standing in
// for the CSS that hides it at a width).
const elementWithCV = Element.prototype as unknown as {
  checkVisibility?: (this: Element) => boolean;
};
elementWithCV.checkVisibility ??= function checkVisibility(this: Element) {
  for (let el: Element | null = this; el; el = el.parentElement) {
    if (getComputedStyle(el).display === "none") {
      return false;
    }
  }
  return true;
};

afterEach(() => {
  cleanup();
});
