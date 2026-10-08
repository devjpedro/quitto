import { PersonAvatar } from "@/components/ui/person-avatar";
import { m } from "@/paraglide/messages.js";
import type { PublicInvitePreview } from "../api";

/** The invite on top of the login (mockup 15, H2): who invited and what, so the sign-in has a reason. */
export function LoginInviteContext({
  preview,
}: {
  preview: PublicInvitePreview;
}) {
  return (
    <div
      className="mb-6 flex items-center gap-3 rounded-card bg-surface-card px-4 py-3"
      data-testid="login-invite"
    >
      <PersonAvatar name={preview.inviterName} size="md" />
      <span className="min-w-0">
        <small className="block text-[12.5px] text-ink-muted">
          {m.login_invite_from({ name: preview.inviterName })}
        </small>
        <b className="block truncate font-semibold text-sm">
          {preview.contractTitle}
        </b>
      </span>
    </div>
  );
}
