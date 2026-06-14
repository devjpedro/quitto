import { formatISODateBR } from "../dates";
import { formatCentsBRL } from "../money";
import { DOC_INSTALLMENT_STATUS_LABEL, DOC_TEXT } from "./labels";
import type { StatementModel } from "./model";

/** Builds a semicolon-delimited CSV (pt-BR Excel default) of the statement rows. */
export function buildStatementCsv(model: StatementModel): string {
  const header = DOC_TEXT.tableHeaders.join(";");
  const lines = model.rows.map((r) =>
    [
      String(r.sequence),
      formatISODateBR(r.dueDate),
      formatCentsBRL(r.amountCents),
      DOC_INSTALLMENT_STATUS_LABEL[r.status],
      r.paidAt ? formatISODateBR(r.paidAt) : "",
    ].join(";")
  );
  return [header, ...lines].join("\r\n");
}
