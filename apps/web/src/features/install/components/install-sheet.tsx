import {
  BookOpen,
  CaretLeft,
  CaretRight,
  Copy,
  Export,
  PlusSquare,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { m } from "@/paraglide/messages.js";
import { setInstallSheetOpen, useInstallState } from "../lib/install-store";

const HI = "bg-brand-subtle text-brand shadow-[inset_0_0_0_2px_var(--brand)]";

function Step({
  children,
  hint,
  n,
  title,
}: {
  children: ReactNode;
  hint: string;
  n: number;
  title: string;
}) {
  return (
    <li className="flex gap-3 rounded-card bg-surface-card py-3.5 pr-3.5 pl-3">
      <span
        aria-hidden="true"
        className="size-7 shrink-0 rounded-full bg-brand-subtle text-center font-mono font-semibold text-brand text-xs leading-7"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="font-semibold text-[15px] leading-snug">{title}</p>
        <p className="mt-0.5 text-[13px] text-ink-muted leading-snug">{hint}</p>
        <div
          aria-hidden="true"
          className="mt-3 overflow-hidden rounded-control bg-surface"
        >
          {children}
        </div>
      </div>
    </li>
  );
}

/** Mockup 21, M2: the three steps of "Add to Home Screen". The pieces are drawn with the app's tokens, never an iOS screenshot. */
export function InstallSheet() {
  const { platform, sheetOpen } = useInstallState();
  const ipad = platform.kind === "ios" && platform.device === "ipad";
  return (
    <ResponsiveSheet
      leading={
        <img
          alt=""
          className="size-9"
          height={36}
          src="/icon-192.png"
          width={36}
        />
      }
      onOpenChange={setInstallSheetOpen}
      open={sheetOpen}
      title={
        ipad ? m.install_sheet_title_ipad() : m.install_sheet_title_iphone()
      }
    >
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        <Step
          hint={m.install_step1_hint()}
          n={1}
          title={m.install_step1_title()}
        >
          <div className="flex h-[52px] items-center justify-around text-ink-muted text-xl">
            <CaretLeft />
            <CaretRight />
            <span
              className={`flex size-[42px] items-center justify-center rounded-control ${HI}`}
            >
              <Export size={22} />
            </span>
            <BookOpen />
            <Copy />
          </div>
        </Step>
        <Step
          hint={m.install_step2_hint()}
          n={2}
          title={m.install_step2_title()}
        >
          <div className="flex h-11 items-center justify-between px-3 text-sm">
            <span>{m.install_ill_copy()}</span>
            <Copy className="text-ink-muted" size={20} />
          </div>
          <div
            className={`flex h-11 items-center justify-between rounded-control px-3 font-medium text-sm ${HI}`}
          >
            <span className="text-ink">{m.install_ill_add_home()}</span>
            <PlusSquare size={20} />
          </div>
        </Step>
        <Step
          hint={m.install_step3_hint()}
          n={3}
          title={m.install_step3_title()}
        >
          <div className="pb-3">
            <div className="flex h-11 items-center justify-between pr-1.5 pl-3 text-ink-muted text-sm">
              <span>{m.install_ill_cancel()}</span>
              <span
                className={`inline-flex h-8 items-center rounded-[8px] px-3 font-semibold ${HI}`}
              >
                {m.install_ill_add()}
              </span>
            </div>
            <div className="flex items-center gap-2.5 px-3">
              <img
                alt=""
                className="size-9"
                height={36}
                src="/icon-192.png"
                width={36}
              />
              <div>
                <p className="font-medium text-sm">Quitto</p>
                <p className="text-ink-muted text-xs">{window.location.host}</p>
              </div>
            </div>
          </div>
        </Step>
      </ol>
    </ResponsiveSheet>
  );
}
