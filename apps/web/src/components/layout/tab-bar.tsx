import { Plus } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { m } from "@/paraglide/messages.js";
import { PRIMARY_NAV } from "./nav-items";

const TAB =
  "flex min-h-11 min-w-16 flex-col items-center justify-center gap-0.5 rounded-control text-[10px] text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand data-[status=active]:font-semibold data-[status=active]:text-ink";

export function TabBar() {
  const [now, contracts] = PRIMARY_NAV;
  const tabs = [now, contracts].filter((item) => item !== undefined);
  return (
    <nav
      aria-label={m.nav_primary()}
      className="fixed inset-x-0 bottom-0 z-30 border-line border-t bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto flex max-w-md items-end justify-around px-2 pt-1.5 pb-1.5">
        {tabs.map((item) => (
          <li key={item.to}>
            <Link
              activeOptions={{ exact: item.exact }}
              className={TAB}
              to={item.to}
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    aria-hidden="true"
                    size={22}
                    weight={isActive ? "fill" : "regular"}
                  />
                  {item.label()}
                </>
              )}
            </Link>
          </li>
        ))}
        <li>
          <Link
            aria-label={m.nav_new_contract()}
            className="-mt-4 flex size-12 items-center justify-center rounded-[14px] bg-brand-surface text-on-brand shadow-float focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 active:scale-[.97] motion-reduce:active:scale-100"
            to="/contracts/new"
          >
            <Plus aria-hidden="true" size={22} weight="bold" />
          </Link>
        </li>
      </ul>
    </nav>
  );
}
