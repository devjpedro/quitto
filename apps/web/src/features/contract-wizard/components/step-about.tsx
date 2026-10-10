import { ArrowDownLeft, ArrowUpRight } from "@phosphor-icons/react";
import { FieldNote, TextArea, TextField } from "@/components/ui/field";
import { OptionCard, OptionGroup } from "@/components/ui/option-card";
import { ResponsiveText } from "@/components/ui/responsive-text";
import { errorCodeText } from "@/lib/error-codes";
import { m } from "@/paraglide/messages.js";
import type { ContractWizard } from "../hooks/use-contract-wizard";
import { fieldId } from "../lib/field-id";
import type { WizardField } from "../lib/wizard-fields";
import { StepHeading } from "./step-heading";

/** Step 1 (mockup 15, D1/C): the side, the name, the optional description. */
export function StepAbout({ wizard }: { wizard: ContractWizard }) {
  const { locale, values } = wizard;
  const errorOf = (field: WizardField) => {
    const issue = wizard.issueFor(field);
    return issue
      ? errorCodeText(issue.code, issue.params ?? {}, locale)
      : undefined;
  };
  const roleError = errorOf("ownerRole");
  return (
    <>
      <StepHeadingFor wizard={wizard} />
      <OptionGroup
        className="mt-[18px] md:mt-[22px]"
        describedBy={roleError ? `${fieldId("ownerRole")}-note` : undefined}
        id={fieldId("ownerRole")}
        invalid={Boolean(roleError)}
        label={m.wizard_about_question()}
        layout="tall"
        onValueChange={(value) =>
          wizard.setValue("ownerRole", value as "buyer" | "seller")
        }
        value={values.ownerRole}
      >
        <OptionCard
          checked={values.ownerRole === "buyer"}
          hint={
            <ResponsiveText
              narrow={m.wizard_role_pay_hint_short()}
              wide={m.wizard_role_pay_hint()}
            />
          }
          icon={ArrowUpRight}
          title={m.wizard_role_pay()}
          value="buyer"
          variant="tall"
        />
        <OptionCard
          checked={values.ownerRole === "seller"}
          hint={
            <ResponsiveText
              narrow={m.wizard_role_receive_hint_short()}
              wide={m.wizard_role_receive_hint()}
            />
          }
          icon={ArrowDownLeft}
          title={m.wizard_role_receive()}
          value="seller"
          variant="tall"
        />
      </OptionGroup>
      <FieldNote error={roleError} id={fieldId("ownerRole")} />
      <div className="mt-[18px] flex flex-col gap-3.5 md:mt-5 md:gap-4">
        <TextField
          error={errorOf("title")}
          hint={m.wizard_title_help()}
          id={fieldId("title")}
          label={m.wizard_title_label()}
          onBlur={() => wizard.blur("title")}
          onChange={(event) => wizard.setValue("title", event.target.value)}
          placeholder={m.wizard_title_placeholder()}
          tall
          value={values.title}
        />
        <TextArea
          error={errorOf("description")}
          id={fieldId("description")}
          label={m.wizard_description_label()}
          onBlur={() => wizard.blur("description")}
          onChange={(event) =>
            wizard.setValue("description", event.target.value)
          }
          optionalLabel={m.wizard_optional()}
          placeholder={m.wizard_description_placeholder()}
          rows={2}
          value={values.description}
        />
      </div>
    </>
  );
}

function StepHeadingFor({ wizard }: { wizard: ContractWizard }) {
  return (
    <StepHeading
      headingRef={wizard.stepHeadingRef}
      lead={m.wizard_about_lead()}
      title={m.wizard_about_question()}
    />
  );
}
