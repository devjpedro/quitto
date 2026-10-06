import { type FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/field";
import type { ContractDetail } from "@/features/contracts/types";
import { m } from "@/paraglide/messages.js";
import { useDisputeMutation } from "../api";
import { PANEL_TONE, type PanelMode, usePanel } from "./panel-context";

const MAX_REASON = 500;

/**
 * "Contestar" (mockup 14, P4): the reason, which the payer reads ("Rafael vê
 * o motivo." is the one consequence the screen does not show). Blank sends
 * nothing.
 */
export function ContestForm({
  contract,
  mode,
}: {
  contract: ContractDetail;
  mode: PanelMode;
}) {
  const { contractId, installmentId, setContestOpen } = usePanel();
  const dispute = useDisputeMutation(contractId);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    field.current?.focus();
  }, []);
  const payer =
    contract.participants.find((p) => p.role === "buyer")?.displayName ?? "";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = reason.trim();
    if (!text) {
      setError(m.panel_contest_required());
      field.current?.focus();
      return;
    }
    dispute.mutate(
      { installmentId, reason: text },
      { onSuccess: () => setContestOpen(false) }
    );
  };

  return (
    <form className="flex flex-col" noValidate onSubmit={submit}>
      <TextArea
        counter={m.contract_counter({ count: reason.length, max: MAX_REASON })}
        error={error}
        hint={m.panel_contest_hint({ name: payer.split(" ")[0] ?? payer })}
        id="contest-reason"
        label={m.panel_contest_label()}
        maxLength={MAX_REASON}
        onChange={(event) => {
          setReason(event.target.value);
          if (error) {
            setError(undefined);
          }
        }}
        ref={field}
        value={reason}
      />
      <div className="mt-3 flex gap-2">
        <Button className="flex-1" disabled={dispute.isPending} type="submit">
          {m.panel_contest_send()}
        </Button>
        <Button
          className={PANEL_TONE[mode].button}
          onClick={() => setContestOpen(false)}
          variant="inset"
        >
          {m.contract_cancel()}
        </Button>
      </div>
    </form>
  );
}
