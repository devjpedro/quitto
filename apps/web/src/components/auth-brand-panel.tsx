type AuthMode = "signin" | "signup";

const PANEL_COPY: Record<AuthMode, { headline: string; sub: string }> = {
  signin: {
    headline: "Cada parcela no seu lugar.",
    sub: "Acompanhe contratos, comprovantes e quitações com clareza.",
  },
  signup: {
    headline: "Comece a quitar.",
    sub: "Crie sua conta e cadastre seu primeiro contrato em minutos.",
  },
};

export function AuthBrandPanel({ mode }: { mode: AuthMode }) {
  const copy = PANEL_COPY[mode];

  return (
    <aside className="relative flex flex-col overflow-hidden bg-brand-panel bg-primary px-8 py-8 text-primary-foreground md:w-[45%] md:px-12 md:py-14">
      {/* motivo decorativo (anéis) — só desktop, sem semântica */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden md:block"
      >
        <span className="absolute -top-16 -right-12 h-52 w-52 rounded-full border border-white/15" />
        <span className="absolute -bottom-36 -left-20 h-80 w-80 rounded-full border border-white/15" />
        <span className="absolute top-24 left-10 h-24 w-24 rounded-full border border-white/10" />
      </div>

      <span className="font-bold font-display text-lg tracking-tight">
        ◷ Quitto
      </span>

      <div className="mt-auto">
        <h2 className="font-bold font-display text-3xl leading-[1.08] tracking-tight md:text-4xl">
          {copy.headline}
        </h2>
        <p className="mt-3 max-w-sm text-primary-foreground/80 text-sm md:mt-4">
          {copy.sub}
        </p>

        {/* chip de progresso ilustrativo (estático, decorativo) — só desktop */}
        <div
          aria-hidden="true"
          className="mt-6 hidden items-center gap-2 text-primary-foreground/90 text-xs md:flex"
        >
          <span className="h-1.5 w-28 overflow-hidden rounded-full bg-white/20">
            <span className="block h-full w-[62%] rounded-full bg-white/70" />
          </span>
          62% quitado
        </div>
      </div>
    </aside>
  );
}
