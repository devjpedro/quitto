import { GearSix, Moon, SignOut, Sun } from "@phosphor-icons/react";
import { isLocale, LOCALES } from "@quitto/shared";
import { Link } from "@tanstack/react-router";
import { DropdownMenu } from "radix-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { useChangeLocale } from "@/hooks/use-change-locale";
import { useSignOut } from "@/hooks/use-sign-out";
import { useTheme } from "@/hooks/use-theme";
import { LOCALE_NAME } from "@/lib/locale-names";
import type { SessionIdentity } from "@/lib/session-resolver";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { Avatar } from "./avatar";

const ITEM =
  "flex min-h-11 cursor-pointer select-none items-center gap-2.5 rounded-[8px] px-2.5 text-sm text-ink outline-none data-[highlighted]:bg-surface-sunken md:min-h-9";

export function AccountMenu({
  identity,
  variant,
}: {
  identity: SessionIdentity | null;
  variant: "full" | "avatar";
}) {
  const { theme, setTheme } = useTheme();
  const changeLocale = useChangeLocale();
  const signOut = useSignOut();
  const isDark = theme === "dark";
  // WCAG 2.5.3: when the name is on screen, the accessible name includes it.
  const triggerLabel =
    variant === "full" && identity
      ? m.account_menu_named({ name: identity.name })
      : m.account_menu();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={triggerLabel}
        className={cn(
          "flex items-center gap-2.5 rounded-control text-left transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
          variant === "full" ? "w-full p-2" : "size-11 justify-center"
        )}
      >
        <Avatar identity={identity} />
        {variant === "full" ? (
          <span className="min-w-0 flex-1">
            {identity ? (
              <>
                <span className="block truncate font-medium text-ink text-sm">
                  {identity.name}
                </span>
                <span className="block truncate text-ink-muted text-xs">
                  {identity.email}
                </span>
              </>
            ) : (
              <Skeleton className="h-3 w-24" />
            )}
          </span>
        ) : null}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="z-50 min-w-56 rounded-card border border-line bg-surface p-1.5 text-ink shadow-float"
          sideOffset={8}
        >
          <DropdownMenu.Item asChild className={ITEM}>
            <Link to="/settings">
              <GearSix aria-hidden="true" size={18} />
              {m.account_settings()}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={ITEM}
            onSelect={() => setTheme(isDark ? "light" : "dark")}
          >
            {isDark ? (
              <Sun aria-hidden="true" size={18} />
            ) : (
              <Moon aria-hidden="true" size={18} />
            )}
            {isDark ? m.account_theme_light() : m.account_theme_dark()}
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Label className="px-2.5 py-1 text-ink-muted text-xs">
            {m.account_language()}
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            onValueChange={(value) => {
              if (isLocale(value) && value !== getLocale()) {
                changeLocale(value);
              }
            }}
            value={getLocale()}
          >
            {LOCALES.map((locale) => (
              <DropdownMenu.RadioItem
                className={ITEM}
                key={locale}
                value={locale}
              >
                <span className="flex-1">{LOCALE_NAME[locale]}</span>
                <DropdownMenu.ItemIndicator className="size-1.5 rounded-full bg-brand" />
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item
            className={cn(ITEM, "text-danger")}
            onSelect={() => signOut()}
          >
            <SignOut aria-hidden="true" size={18} />
            {m.account_sign_out()}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
