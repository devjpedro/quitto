import { AppIcon } from "@/components/app-icon";
import { BoldParts, rise } from "@/components/stage/stage-panel";
import { buttonVariants } from "@/components/ui/button";
import { m } from "@/paraglide/messages.js";

/** The confirmation e-mail that just went out, so the person knows what to look for (mockup 19, decision 8). It is the e-mail's own text. */
export function MailPiece() {
  const sender = m.auth_stage_mail_sender();
  const subject = m.auth_stage_mail_subject();
  return (
    <div className="piece-rise" style={rise(0)}>
      <p className="mb-2.5 ml-1 text-[13px] text-on-brand-muted">
        <BoldParts
          className="[&_b]:font-medium [&_b]:text-on-brand"
          parts={[sender, subject]}
          text={m.auth_stage_mail_from({ sender, subject })}
        />
      </p>
      <div className="piece-shadow w-[420px] rounded-panel bg-surface px-7 pt-[26px] pb-6 text-ink">
        <AppIcon size={40} />
        <h3 className="mt-[18px] font-display font-semibold text-[22px] tracking-[-0.025em]">
          {m.auth_stage_mail_heading()}
        </h3>
        <p className="mt-2 text-sm leading-[1.5]">{m.auth_stage_mail_body()}</p>
        <span className={`${buttonVariants()} mt-[18px]`}>
          {m.auth_stage_mail_cta()}
        </span>
        <p className="mt-[18px] border-divider border-t pt-3.5 text-[12.5px] text-ink-muted">
          {m.auth_stage_mail_footer()}
        </p>
      </div>
    </div>
  );
}
