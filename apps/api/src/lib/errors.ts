import { type ApiErrorBody, isContractErrorCode } from "@quitto/shared";

export class AppError extends Error {
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
    this.name = "AppError";
    this.code = args.code;
    this.httpStatus = args.httpStatus;
    this.details = args.details;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Não autenticado") {
    super({ code: "UNAUTHORIZED", httpStatus: 401, message });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Não encontrado") {
    super({ code: "NOT_FOUND", httpStatus: 404, message });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Sem permissão") {
    super({ code: "FORBIDDEN", httpStatus: 403, message });
  }
}

export class ValidationError extends AppError {
  constructor(message = "Dados inválidos", details?: Record<string, unknown>) {
    super({ code: "VALIDATION", httpStatus: 422, message, details });
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflito") {
    super({ code: "CONFLICT", httpStatus: 409, message });
  }
}

export class RateLimitedError extends AppError {
  constructor(message = "Muitas tentativas. Espere um minuto.") {
    super({ code: "RATE_LIMITED", httpStatus: 429, message });
  }
}

/** A 422 whose code the web translates; details carry the field's path and the message's parameters. */
export class CodedError extends AppError {
  constructor(args: {
    code: string;
    httpStatus?: number;
    params?: Record<string, unknown>;
    path?: string;
  }) {
    super({
      code: args.code,
      httpStatus: args.httpStatus ?? 422,
      message: args.code,
      details: {
        ...(args.path === undefined ? {} : { path: args.path }),
        ...args.params,
      },
    });
    this.name = "CodedError";
  }
}

interface CodedIssue {
  message: string;
  params?: Record<string, unknown>;
  path: readonly PropertyKey[];
}

/**
 * The first zod issue as the API error (its message is the code, planner's
 * decision 2); anything that is not a known code is contract.create.failed.
 */
export function codedValidationError(
  issues: readonly CodedIssue[]
): CodedError {
  const [first] = issues;
  if (!(first && isContractErrorCode(first.message))) {
    return new CodedError({ code: "contract.create.failed" });
  }
  return new CodedError({
    code: first.message,
    path: first.path.map(String).join("."),
    params: first.params,
  });
}

export function toErrorBody(error: AppError): ApiErrorBody {
  return {
    error: { code: error.code, message: error.message, details: error.details },
  };
}
