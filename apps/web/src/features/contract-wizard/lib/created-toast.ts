import { m } from "@/paraglide/messages.js";

export type CreatedToast =
  | { description?: string; kind: "success"; title: string }
  | { kind: "warning"; title: string };

/** The toast after creating (owner's decision 17): with the invite sent, without another party, or the invite that did not go out. */
export function createdToast(
  invite: { email: string; sent: boolean } | null
): CreatedToast {
  if (!invite) {
    return { kind: "success", title: m.wizard_toast_created() };
  }
  if (invite.sent) {
    return {
      kind: "success",
      title: m.wizard_toast_created(),
      description: m.wizard_toast_invite_sent({ email: invite.email }),
    };
  }
  return { kind: "warning", title: m.wizard_toast_invite_failed() };
}
