import {
  SHELL_COLUMN,
  ShellFrame,
  ShellLogoRow,
} from "@/components/layout/shell-frame";

/**
 * While the invite loads on a client navigation (the SSR streams it with
 * the page): the frame without content, the logo and the block's edge
 * already where they will stay.
 */
export function InviteFallback() {
  return (
    <ShellFrame
      column={
        <div className={SHELL_COLUMN}>
          <ShellLogoRow />
        </div>
      }
      fit="screen"
    >
      <div aria-busy="true" className="h-full min-h-dvh md:min-h-0" />
    </ShellFrame>
  );
}
