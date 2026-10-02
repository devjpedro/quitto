import { ApiError } from "@/lib/api-client";

/** The session is really gone (vs. a cold/transient failure): 401 from the API. */
export function isSessionLost(error: unknown): boolean {
  return error instanceof ApiError && error.httpStatus === 401;
}
