import { Skeleton } from "@/components/ui/skeleton";

/** The shape of Ajustes while /me loads: the list on the left and a block on the right. */
export function SettingsSkeleton() {
  return (
    <div className="md:grid md:grid-cols-[240px_minmax(0,560px)] md:gap-x-10">
      <div className="hidden flex-col gap-1.5 md:flex">
        {[0, 1, 2, 3, 4].map((row) => (
          <Skeleton className="h-11" key={row} />
        ))}
      </div>
      <div className="max-md:hidden">
        <Skeleton className="mb-3 h-6 w-32" />
        <Skeleton className="h-24 rounded-card" />
      </div>
      <div className="flex flex-col gap-2 md:hidden">
        {[0, 1, 2, 3, 4].map((row) => (
          <Skeleton className="h-[68px] rounded-card" key={row} />
        ))}
      </div>
    </div>
  );
}
