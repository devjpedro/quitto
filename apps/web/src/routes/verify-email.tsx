import { createFileRoute, redirect } from "@tanstack/react-router";
import { VerifyEmailPage } from "@/features/auth/components/verify-email-page";
import { verifyTarget } from "@/features/auth/lib/verify-redirect";

export const Route = createFileRoute("/verify-email")({
  // The link in the e-mail goes through Better Auth, which confirms the address,
  // opens the session and lands here with the target; ?error= means it did not.
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
    error: typeof s.error === "string" ? s.error : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (!search.error) {
      throw redirect({ href: verifyTarget(search.redirect) });
    }
  },
  component: VerifyEmailPage,
});
