import { createFileRoute } from "@tanstack/react-router";
import { ResetPasswordPage } from "@/features/auth/reset-password-page";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s.token === "string" ? s.token : undefined,
  }),
  component: ResetPasswordPage,
});
