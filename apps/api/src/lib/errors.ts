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

export function toErrorBody(error: AppError): ApiErrorBody {
  return {
    error: { code: error.code, message: error.message, details: error.details },
  };
}
