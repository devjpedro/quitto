import type { api } from "@/lib/api";

type DetailResponse = Awaited<
  ReturnType<ReturnType<typeof api.api.installments>["get"]>
>;

/** GET /api/installments/:id (Task 1): what the installment panel draws. */
export type InstallmentDetail = NonNullable<DetailResponse["data"]>;
export type ProofItem = InstallmentDetail["proofs"][number];
