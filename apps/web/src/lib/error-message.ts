import { isContractErrorCode } from "@quitto/shared";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { ApiError } from "./api-client";
import { codeParams, errorCodeText } from "./error-codes";

/** Maps any thrown value to a user-facing message in the reader's language. 5xx and unknown -> generic. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    // A contract code (phase 3) is translated; the API's own message is a code too.
    if (isContractErrorCode(error.code)) {
      return errorCodeText(error.code, codeParams(error.details), getLocale());
    }
    if (error.httpStatus >= 500 || error.code === "UNKNOWN") {
      return m.app_error_generic();
    }
    return error.message;
  }
  return m.app_error_generic();
}
