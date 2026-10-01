import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { parseSidebarCookie, type SidebarState } from "@/lib/sidebar";

/** Lê o cookie `sidebar` da request no SSR (undefined = 1ª visita → default expandida). */
export const getSidebarSSR = createServerFn({ method: "GET" }).handler(
  (): SidebarState | undefined => {
    const cookie = getRequest().headers.get("cookie");
    return parseSidebarCookie(cookie);
  }
);
