import { createFileRoute } from "@tanstack/react-router";
import { ResetPasswordPage } from "@/features/auth/components/reset-password-page";

export const Route = createFileRoute("/reset-password")({
  // Better Auth redirects here with ?token=… or, for a spent or expired link, ?error=INVALID_TOKEN.
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s.token === "string" ? s.token : undefined,
    error: typeof s.error === "string" ? s.error : undefined,
  }),
  component: ResetPasswordPage,
});
