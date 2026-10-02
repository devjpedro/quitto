import handler from "@tanstack/react-start/server-entry";
import { paraglideMiddleware } from "./paraglide/server.js";

// Resolves the request locale (cookie → Accept-Language → pt-BR) and scopes
// it to this request, so getLocale() is correct during SSR.
export default {
  fetch(request: Request): Promise<Response> {
    return paraglideMiddleware(request, () => handler.fetch(request));
  },
};
