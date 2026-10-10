import type { api } from "@/lib/api";

type DetailResponse = Awaited<
  ReturnType<ReturnType<typeof api.api.installments>["get"]>
>;

/** GET /api/installments/:id (Task 1): what the installment panel draws. */
export type InstallmentDetail = NonNullable<DetailResponse["data"]>;
export type ProofItem = InstallmentDetail["proofs"][number];

/** Where the installment panel lives: the contract page or the Parcelas list. */
export interface PanelRoute {
  closeInstallment: () => Promise<void> | void;
  installmentId: string | null;
  /** The installments around the open one, in the screen's order (↑ ↓). */
  neighbors: (installmentId: string) => {
    next: string | null;
    prev: string | null;
  };
  openHistory: (options: { closePanel: boolean }) => void;
  openInstallment: (installmentId: string) => Promise<void> | void;
  today: string;
}

/** What a next-action card needs of a route: the contract page and Parcelas both give it. */
export type CardRoute = Pick<PanelRoute, "openInstallment" | "today">;

/** GET /api/installments: the list's response and one row of it. */
export type InstallmentList = NonNullable<
  Awaited<ReturnType<typeof api.api.installments.get>>["data"]
>;
export type InstallmentListItem = InstallmentList["items"][number];
