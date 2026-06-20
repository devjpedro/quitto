import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";

// Shown by the router while a beforeLoad/loader exceeds the pending threshold
// (e.g. Fly cold start). A content skeleton — not a spinner — reads as "page
// loading" and stays on-brand, matching the per-route skeletons (DashboardSkeleton).
export function AppPending() {
  return (
    <PageContainer>
      <Skeleton className="mb-2 h-9 w-48" />
      <Skeleton className="mb-6 h-4 w-64" />
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
      <Skeleton className="mb-3 h-4 w-40" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    </PageContainer>
  );
}
