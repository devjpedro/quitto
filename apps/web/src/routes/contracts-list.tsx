import { Link } from "@tanstack/react-router";
import { ContractRow } from "@/components/contract-row";
import { PageContainer } from "@/components/page-container";
import { PendingInvitesBanner } from "@/components/pending-invites-banner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useContractsQuery } from "@/hooks/use-contracts";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { PAGE_TITLE } from "@/lib/page-title";

type Contract = NonNullable<
  ReturnType<typeof useContractsQuery>["data"]
>[number];

function ContractsListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}

function ContractsEmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-border border-dashed bg-card/50 p-12 text-center">
      <div
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-primary/10 font-bold font-display text-lg text-primary"
      >
        ₿
      </div>
      <div>
        <p className="font-display font-semibold text-foreground">
          Você ainda não tem contratos.
        </p>
        <p className="mt-1 text-muted-foreground text-sm">
          Crie um contrato para começar a acompanhar os pagamentos.
        </p>
      </div>
      <Button asChild>
        <Link to="/contracts/new">Criar seu primeiro contrato</Link>
      </Button>
    </div>
  );
}

function ContractsListBody({
  data,
  isPending,
}: {
  data: Contract[] | undefined;
  isPending: boolean;
}) {
  if (isPending) {
    return <ContractsListSkeleton />;
  }
  if (data && data.length > 0) {
    return (
      <div className="flex flex-col gap-3">
        {data.map((contract) => (
          <ContractRow contract={contract} key={contract.id} />
        ))}
      </div>
    );
  }
  return <ContractsEmptyState />;
}

export function ContractsListPage() {
  useDocumentTitle(PAGE_TITLE.contracts);
  const { data, isPending } = useContractsQuery();

  return (
    <PageContainer>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-bold font-display text-2xl text-foreground tracking-tight">
            Contratos
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Acompanhe pagamentos, parcelas e atrasos.
          </p>
        </div>
        <Button asChild>
          <Link to="/contracts/new">Novo contrato</Link>
        </Button>
      </div>

      <PendingInvitesBanner />

      <ContractsListBody data={data} isPending={isPending} />
    </PageContainer>
  );
}
