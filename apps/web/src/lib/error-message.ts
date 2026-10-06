import { isContractErrorCode } from "@quitto/shared";
import { getLocale } from "@/paraglide/runtime.js";
import { ApiError } from "./api-client";
import { codeParams, errorCodeText } from "./error-codes";

const GENERIC = "Algo deu errado. Tente novamente.";

/** Maps any thrown value to a user-facing pt-BR message. 5xx and unknown -> generic. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    // A contract code (phase 3) is translated; the API's own message is a code too.
    if (isContractErrorCode(error.code)) {
      return errorCodeText(error.code, codeParams(error.details), getLocale());
    }
    if (error.httpStatus >= 500 || error.code === "UNKNOWN") {
      return GENERIC;
    }
    return error.message;
  }
  return GENERIC;
}
