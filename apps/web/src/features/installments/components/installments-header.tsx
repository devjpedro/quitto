import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { m } from "@/paraglide/messages.js";

const route = getRouteApi("/_app/installments");

/** "Parcelas" and the Lista | Calendário switch: drawn at once, also while the list loads. */
export function InstallmentsHeader() {
  const search = route.useSearch();
  const navigate = useNavigate({ from: "/installments" });
  return (
    <div className="flex items-center justify-between gap-3">
      <h1 className="font-bold font-display text-[28px] leading-[1.1] tracking-[-0.035em] md:text-[32px]">
        {m.installments_title()}
      </h1>
      <div data-testid="installments-view">
        <SegmentedControl
          label={m.installments_view_label()}
          onValueChange={(view) =>
            navigate({
              search: (prev) => ({
                ...prev,
                view: view === "calendar" ? "calendar" : undefined,
              }),
              replace: true,
              resetScroll: false,
            })
          }
          options={[
            { value: "list", label: m.installments_view_list() },
            { value: "calendar", label: m.installments_view_calendar() },
          ]}
          value={search.view === "calendar" ? "calendar" : "list"}
        />
      </div>
    </div>
  );
}
