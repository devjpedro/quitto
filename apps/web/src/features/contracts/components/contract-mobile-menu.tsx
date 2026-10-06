import { DotsThreeVertical } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useHydrated } from "@tanstack/react-router";
import { IconButton } from "@/components/ui/icon-button";
import { m } from "@/paraglide/messages.js";
import { contractQueryOptions } from "../api";
import { ContractActionsMenu } from "./contract-menus";

/**
 * The "⋯" in the phone's top bar (decision 35), outside the page: it reads
 * the contract without suspense and without throwing (the page shows the
 * 404), and only after hydration, so the server's HTML (a disabled trigger)
 * and the first client render match even when the streamed contract is
 * already in the cache.
 */
export function ContractMobileMenu({ contractId }: { contractId: string }) {
  const hydrated = useHydrated();
  const { data, isError } = useQuery({
    ...contractQueryOptions(contractId),
    enabled: hydrated,
    throwOnError: false,
  });
  // The page shows the 404 itself (the query resolves to null there): a "⋯"
  // that can never open is just noise.
  if (isError || data === null) {
    return null;
  }
  if (!(hydrated && data)) {
    return (
      <IconButton
        disabled
        icon={DotsThreeVertical}
        label={m.contract_actions_mobile()}
      />
    );
  }
  return <ContractActionsMenu detail={data} variant="mobile" />;
}
