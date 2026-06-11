import { ApiError } from "./api-client";

const GENERIC = "Algo deu errado. Tente novamente.";

/** Maps any thrown value to a user-facing pt-BR message. 5xx and unknown -> generic. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.httpStatus >= 500 || error.code === "UNKNOWN") {
      return GENERIC;
    }
    return error.message;
  }
  return GENERIC;
}
