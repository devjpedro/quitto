import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/features/auth/login-page";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  component: LoginPage,
});
