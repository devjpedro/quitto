import { type ContractErrorCode, isContractErrorCode } from "@quitto/shared";
import { ApiError } from "@/lib/api-client";
import { codeParams } from "@/lib/error-codes";
import { fieldOfPath } from "./wizard-fields";
import type { FieldIssue } from "./wizard-validation";

/**
 * A failed create as the wizard shows it (planner's decision 28): a 422
 * with a known code and path goes back to its step and field; anything
 * else is one toast with the generic sentence.
 */
export function createFailure(
  error: unknown
):
  | { issue: FieldIssue; kind: "field" }
  | { kind: "session" }
  | { code: ContractErrorCode; kind: "toast" } {
  // The session went away mid-wizard: the session gate takes it to the login.
  if (error instanceof ApiError && error.httpStatus === 401) {
    return { kind: "session" };
  }
  if (error instanceof ApiError && isContractErrorCode(error.code)) {
    const path = error.details?.path;
    const field = fieldOfPath(typeof path === "string" ? path : undefined);
    if (field) {
      return {
        kind: "field",
        issue: { field, code: error.code, params: codeParams(error.details) },
      };
    }
    return { kind: "toast", code: error.code };
  }
  return { kind: "toast", code: "contract.create.failed" };
}
