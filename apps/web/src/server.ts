import handler from "@tanstack/react-start/server-entry";
import { withPaintFirst } from "./lib/paint-first";
import { paraglideMiddleware } from "./paraglide/server.js";

// Resolves the request locale (cookie → Accept-Language → pt-BR) and scopes
// it to this request, so getLocale() is correct during SSR. The HTML paints
// before the JS is asked for (lib/paint-first.ts).
export default {
  async fetch(request: Request): Promise<Response> {
    return withPaintFirst(
      await paraglideMiddleware(request, () => handler.fetch(request))
    );
  },
};
