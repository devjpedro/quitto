import { User, Users } from "@phosphor-icons/react";
import { CheckboxCard } from "@/components/ui/checkbox-card";
import { TextField } from "@/components/ui/field";
import { OptionCard, OptionGroup } from "@/components/ui/option-card";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { ResponsiveText } from "@/components/ui/responsive-text";
import { errorCodeText } from "@/lib/error-codes";
import { m } from "@/paraglide/messages.js";
import type { ContractWizard } from "../hooks/use-contract-wizard";
import { confirmTitle } from "../lib/confirm-title";
import { fieldId } from "../lib/field-id";
import type { WizardField } from "../lib/wizard-fields";
import { StepHeading } from "./step-heading";

/**
 * Step 3 (mockup 15, D3): optional. The other party's name (with a face)
 * and the e-mail for the invite; "confirmar cada pagamento" only with
 * another party (owner's decision 10), worded from the side of who is
 * creating. The invite is said once, in the e-mail's help (ajuste-15 §5.2).
 */
export function StepParty({ wizard }: { wizard: ContractWizard }) {
  const { locale, values } = wizard;
  const errorOf = (field: WizardField) => {
    const issue = wizard.issueFor(field);
    return issue
      ? errorCodeText(issue.code, issue.params ?? {}, locale)
      : undefined;
  };
  const name = values.counterpartyName.trim();
  const firstName = name.split(" ")[0] || null;
  const receives = values.ownerRole === "seller";
  return (
    <>
      <StepHeading
        headingRef={wizard.stepHeadingRef}
        lead={m.wizard_party_lead()}
        title={m.wizard_party_question()}
      />
      <OptionGroup
        className="mt-[18px] md:mt-[22px]"
        id={fieldId("party")}
        label={m.wizard_party_question()}
        layout="list"
        onValueChange={(value) =>
          wizard.setValue("party", value as "solo" | "other")
        }
        value={values.party}
      >
        <OptionCard
          checked={values.party === "solo"}
          hint={m.wizard_party_solo_hint()}
          icon={User}
          title={m.wizard_party_solo()}
          value="solo"
          variant="list"
        />
        <OptionCard
          checked={values.party === "other"}
          hint={
            <ResponsiveText
              narrow={m.wizard_party_other_hint_short()}
              wide={m.wizard_party_other_hint()}
            />
          }
          icon={Users}
          title={m.wizard_party_other()}
          value="other"
          variant="list"
        />
      </OptionGroup>
      {values.party === "other" ? (
        <>
          <div className="mt-[18px] flex flex-col gap-3.5 md:mt-5 md:gap-4">
            <TextField
              autoComplete="off"
              error={errorOf("counterpartyName")}
              id={fieldId("counterpartyName")}
              label={m.wizard_name_label()}
              leading={name ? <PersonAvatar name={name} /> : undefined}
              onBlur={() => wizard.blur("counterpartyName")}
              onChange={(event) =>
                wizard.setValue("counterpartyName", event.target.value)
              }
              placeholder={m.wizard_name_placeholder()}
              tall
              value={values.counterpartyName}
            />
            <TextField
              autoComplete="off"
              error={errorOf("counterpartyEmail")}
              hint={m.wizard_email_help()}
              id={fieldId("counterpartyEmail")}
              inputMode="email"
              label={m.wizard_email_label()}
              onBlur={() => wizard.blur("counterpartyEmail")}
              onChange={(event) =>
                wizard.setValue("counterpartyEmail", event.target.value)
              }
              optionalLabel={m.wizard_optional()}
              placeholder={m.wizard_email_placeholder()}
              tall
              type="email"
              value={values.counterpartyEmail}
            />
          </div>
          <div className="mt-4">
            <CheckboxCard
              checked={values.requiresConfirmation}
              hint={
                receives
                  ? m.wizard_confirm_receive_hint({
                      name: firstName ?? m.wizard_other_party(),
                    })
                  : m.wizard_confirm_pay_hint({
                      name: firstName ?? m.wizard_other_party(),
                    })
              }
              id="wizard-confirm"
              onCheckedChange={(checked) =>
                wizard.setValue("requiresConfirmation", checked)
              }
              title={confirmTitle(receives, firstName)}
            />
          </div>
        </>
      ) : null}
    </>
  );
}
