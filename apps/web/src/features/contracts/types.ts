import type { api } from "@/lib/api";

type DetailResponse = Awaited<
  ReturnType<ReturnType<typeof api.api.contracts>["get"]>
>;

/** GET /api/contracts/:id (Task 2): the contract page's one request. */
export type ContractDetail = NonNullable<DetailResponse["data"]>;
export type ContractInstallment = ContractDetail["installments"][number];
export type ContractParticipant = ContractDetail["participants"][number];
export type ContractEvent = ContractDetail["recentEvents"][number];

/** GET /api/contracts: one card of the list (and the ⌘K's rows). */
export type ContractListItem = NonNullable<
  Awaited<ReturnType<typeof api.api.contracts.get>>["data"]
>[number];
