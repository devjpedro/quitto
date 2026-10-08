import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { errorCodeText } from "@/lib/error-codes";
import { queryKeys } from "@/lib/query-keys";
import { getLocale } from "@/paraglide/runtime.js";
import { useCreateContract } from "../api";
import { createdToast } from "../lib/created-toast";
import { createFailure } from "../lib/request-errors";
import type { FieldIssue } from "../lib/wizard-validation";
import { toRequest, type WizardValues } from "../lib/wizard-values";

/**
 * "Criar contrato": the body, then the contract with the toast of its case
 * (owner's decision 17); a 422 back to its field, any other failure one toast.
 */
export function useWizardSubmit() {
  const create = useCreateContract();
  const navigate = useNavigate();
  const qc = useQueryClient();
  return {
    creating: create.isPending,
    submit: (values: WizardValues, report: (issue: FieldIssue) => void) => {
      const body = toRequest(values);
      if (!body || create.isPending) {
        return;
      }
      create.mutate(body, {
        onSuccess: (created) => {
          const shown = createdToast(created.invite);
          if (shown.kind === "warning") {
            toast.warning(shown.title);
          } else {
            toast.success(
              shown.title,
              shown.description ? { description: shown.description } : undefined
            );
          }
          navigate({
            to: "/contracts/$id",
            params: { id: created.id },
            search: {},
          });
        },
        onError: (error) => {
          const failure = createFailure(error);
          if (failure.kind === "session") {
            // useSessionGate (the _focus layout) sees the 401 on `me` and goes to the login.
            qc.invalidateQueries({ queryKey: queryKeys.me });
          } else if (failure.kind === "field") {
            report(failure.issue);
          } else {
            toast.error(errorCodeText(failure.code, {}, getLocale()));
          }
        },
      });
    },
  };
}
