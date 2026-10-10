import type { ApiErrorBody } from "@quitto/shared";
import { isTimeoutError } from "./with-timeout";

/** Typed client-side error mirroring the backend envelope (spec §8). */
export class ApiError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly details?: Record<string, unknown>;

  constructor(args: {
    code: string;
    httpStatus: number;
    message: string;
    details?: Record<string, unknown>;
  }) {
    super(args.message);
    this.name = "ApiError";
    this.code = args.code;
    this.httpStatus = args.httpStatus;
    this.details = args.details;
  }
}

interface EdenResult<T> {
  data: T | null;
  error: EdenError | null;
}
interface EdenError {
  status?: number;
  value?: unknown;
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as ApiErrorBody).error?.code === "string"
  );
}

/** Unwraps an Eden `{data,error}` promise: returns data, or throws a typed ApiError. */
export async function unwrap<T>(call: Promise<EdenResult<T>>): Promise<T> {
  const { data, error } = await call;
  if (error) {
    // Eden turns a rejected fetch into { status: 503, value: <the thrown error> }:
    // keep the timeout recognizable so the section can say what happened.
    if (isTimeoutError(error.value)) {
      throw error.value;
    }
    const status = error.status ?? 500;
    if (isErrorBody(error.value)) {
      const body = error.value.error;
      throw new ApiError({
        code: body.code,
        httpStatus: status,
        message: body.message,
        details: body.details,
      });
    }
    throw new ApiError({
      code: "UNKNOWN",
      httpStatus: status,
      message: "Algo deu errado. Tente novamente.",
    });
  }
  return data as T;
}

/**
 * unwrap for a resource a link can outlive (an old e-mail or notification
 * for a deleted contract): a 404 is the answer null, not an error, so the SSR
 * renders the "not found" itself instead of throwing into the stream.
 */
export async function unwrapOrNull<T>(
  call: Promise<EdenResult<T>>
): Promise<T | null> {
  try {
    return await unwrap(call);
  } catch (error) {
    if (error instanceof ApiError && error.httpStatus === 404) {
      return null;
    }
    throw error;
  }
}
