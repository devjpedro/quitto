import type { ApiErrorBody } from "@quitto/shared";

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

export function toErrorBody(error: AppError): ApiErrorBody {
  return {
    error: { code: error.code, message: error.message, details: error.details },
  };
}
