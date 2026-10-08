import type { ComponentProps, ReactNode } from "react";

/**
 * A stand-in for the router's <Link> in tests that mock the router: an <a>
 * whose href is the path and its search, so a test can read where it goes.
 */
export function LinkStub({
  children,
  search,
  to,
  ...rest
}: Omit<ComponentProps<"a">, "href"> & {
  children?: ReactNode;
  replace?: boolean;
  search?: Record<string, string | undefined>;
  to: string;
}) {
  const query = new URLSearchParams(
    Object.entries(search ?? {}).filter(
      (entry): entry is [string, string] => entry[1] !== undefined
    )
  ).toString();
  const { replace: _replace, ...anchor } = rest as typeof rest & {
    replace?: boolean;
  };
  return (
    <a {...anchor} href={query ? `${to}?${query}` : to}>
      {children}
    </a>
  );
}
