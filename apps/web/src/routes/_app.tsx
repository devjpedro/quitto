import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { AppSidebar } from "@/components/app-sidebar";
import { BrandLoader } from "@/components/brand-loader";
import { ErrorFallback } from "@/components/error-fallback";
import { meQueryOptions, useMeQuery } from "@/hooks/use-me";
import { ApiError } from "@/lib/api-client";
import { decideClientGate } from "@/lib/app-guard";
import { getSessionSSR } from "@/lib/ssr-session";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    const session = await getSessionSSR();
    if (session.status === "anon") {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    if (session.status === "authed") {
      // desidrata a sessão pro cliente (sem re-fetch / flash)
      context.queryClient.setQueryData(meQueryOptions.queryKey, session.user);
    }
    // unknown (cold) → segue; o cliente resolve com o loader
  },
  component: AppLayout,
});

function AppLayout() {
  const me = useMeQuery();
  const navigate = useNavigate();
  const status = me.error instanceof ApiError ? me.error.httpStatus : undefined;
  const decision = decideClientGate({
    isPending: me.isPending,
    isError: me.isError,
    status,
    data: me.data,
  });

  useEffect(() => {
    if (decision.kind === "redirect") {
      navigate({ to: "/login", search: { redirect: undefined } });
    }
  }, [decision, navigate]);

  if (decision.kind !== "render") {
    return <BrandLoader label="Carregando sua conta" />;
  }

  return (
    <div className="flex min-h-screen">
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        href="#conteudo"
      >
        Pular para o conteúdo
      </a>
      <AppSidebar />
      <main className="flex-1 pb-16 sm:pb-0" id="conteudo" tabIndex={-1}>
        <ErrorBoundary FallbackComponent={ErrorFallback} resetKeys={[me.data]}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
