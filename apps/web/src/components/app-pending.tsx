import { LogoMark } from "@/components/logo";

// Shown by the router while a beforeLoad/loader exceeds the pending threshold
// (e.g. Fly cold start). Replaces the white screen with Quitto's brand identity.
export function AppPending() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      {/* LogoMark only accepts size/variant/style — animate via style opacity animation */}
      <div className="animate-pulse">
        <LogoMark size={40} />
      </div>
      <div className="h-2 w-40 animate-pulse rounded-full bg-muted" />
      <p className="text-muted-foreground text-sm">Carregando…</p>
    </div>
  );
}
