import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages.js";

export interface SidebarContract {
  contractId: string;
  hasOverdue: boolean;
  paidCount: number;
  title: string;
  totalCount: number;
}

/** The 5 newest active contracts and how many there are (features/home picks them, through ShellProps). */
export interface SidebarContracts {
  items: SidebarContract[];
  total: number;
}

// Over the canvas (structure B): the hover steps toward the panel's
// material, and the focus ring sits inside so the rounded row never cuts it.
// pr-1.5: the mockup's 8 px measured from its 210 px sidebar, so the
// fraction ends where the mockup's does and the title gets its 132 px.
// The open contract (data-status=active, aria-current=page) is a tinted fill
// on the whole row, never a side bar: the raised surface, one step past the
// hover. In light it is the panel's white; in dark the panel's surface sat at
// 1.06:1 from the hover and read as a stuck one, so it takes the raised step.
const ROW =
  "group flex h-8 items-center gap-2 rounded-control pr-1.5 pl-3 text-[13px] text-ink transition-colors hover:bg-nav-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset data-[status=active]:bg-surface-raised";

function ContractRow({ contract }: { contract: SidebarContract }) {
  const { paidCount: paid, totalCount: total } = contract;
  const percent = total > 0 ? (paid / total) * 100 : 0;
  return (
    <Link
      className={ROW}
      params={{ id: contract.contractId }}
      to="/contracts/$id"
    >
      <span className="relative shrink-0">
        <ProgressRing percent={percent} size={16} />
        {contract.hasOverdue ? (
          // The status is also said in words (the sr-only text below), never by color alone.
          // The halo is the row's own fill, so it follows the hover and the open row.
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-danger ring-2 ring-canvas transition-shadow group-hover:ring-nav-hover group-data-[status=active]:ring-surface-raised"
          />
        ) : null}
      </span>
      <span className="min-w-0 flex-1 truncate">{contract.title}</span>{" "}
      <span className="sr-only">
        {contract.hasOverdue
          ? m.nav_contract_progress_overdue({ paid, total })
          : m.nav_contract_progress({ paid, total })}
      </span>
      <span
        aria-hidden="true"
        className="text-[11.5px] text-ink-muted tabular-nums"
      >
        {m.nav_contract_fraction({ paid, total })}
      </span>
    </Link>
  );
}

const SKELETON_ROWS = ["first", "second", "third"];

/**
 * The group's shape while the home loads (decision 25): its label and three
 * rows, so the group does not pop in under the pointer. The lime card is
 * pinned to the sidebar's foot, so nothing below the navigation moves.
 */
function ContractsSkeleton() {
  return (
    <div aria-hidden="true" data-sidebar-contracts-skeleton="">
      <Skeleton className="mt-4 mb-1 ml-3 h-4 w-24" />
      <div className="flex flex-col gap-0.5">
        {SKELETON_ROWS.map((key) => (
          <div
            className="flex h-8 items-center gap-2 pr-1.5 pl-3"
            data-skeleton-row=""
            key={key}
          >
            <Skeleton className="size-4 shrink-0 rounded-full" />
            <Skeleton className="h-3 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * "Contratos ativos" (owner's decision 10): up to 5, newest on top, in a
 * fixed order so the list never jumps; each with the logo's ring as its
 * progress and a danger mark when something is overdue. "Ver todos (N)"
 * when there are more. `null` (the home has not arrived, on the server and
 * the hydration pass too) shows the skeleton; no contracts shows nothing.
 */
export function SidebarContractsGroup({
  contracts,
}: {
  contracts: SidebarContracts | null;
}) {
  const headingId = useId();
  if (contracts === null) {
    return <ContractsSkeleton />;
  }
  if (contracts.items.length === 0) {
    return null;
  }
  return (
    <div>
      <p className="mt-4 mb-1 px-3 text-ink-muted text-xs" id={headingId}>
        {m.nav_section_active_contracts()}
      </p>
      <ul aria-labelledby={headingId} className="flex flex-col gap-0.5">
        {contracts.items.map((contract) => (
          <li key={contract.contractId}>
            <ContractRow contract={contract} />
          </li>
        ))}
      </ul>
      {contracts.total > contracts.items.length ? (
        <Link
          // Only the list itself is the current page, not a contract or the wizard under it.
          activeOptions={{ exact: true }}
          className="mt-0.5 flex h-[30px] items-center rounded-control px-3 font-medium text-[13px] text-ink-muted transition-colors hover:bg-nav-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
          to="/contracts"
        >
          {m.nav_see_all_contracts({ count: contracts.total })}
        </Link>
      ) : null}
    </div>
  );
}
