import type {
  ContractErrorCode,
  ContractWarningCode,
  Locale,
} from "@quitto/shared";
import { formatMoney } from "@/lib/locale-format";
import { m } from "@/paraglide/messages.js";

/** The numbers a code's sentence carries (the zod issue's params, or the API's details). */
export interface CodeParams {
  count?: number;
  diff?: number;
}

type Text = (params: CodeParams, locale: Locale) => string;

const money = (cents: number | undefined, locale: Locale) =>
  formatMoney(cents ?? 0, locale);

/** One sentence per code (mockup 15, table T); a Record, so a new code without text fails the typecheck. */
const ERROR_TEXT: Record<ContractErrorCode, Text> = {
  "contract.role.required": (_p, locale) =>
    m.error_contract_role_required({}, { locale }),
  "contract.title.required": (_p, locale) =>
    m.error_contract_title_required({}, { locale }),
  "contract.title.tooLong": (_p, locale) =>
    m.error_contract_title_too_long({}, { locale }),
  "contract.description.tooLong": (_p, locale) =>
    m.error_contract_description_too_long({}, { locale }),
  "schedule.mode.required": (_p, locale) =>
    m.error_schedule_mode_required({}, { locale }),
  "schedule.total.required": (_p, locale) =>
    m.error_schedule_total_required({}, { locale }),
  "schedule.total.min": (_p, locale) =>
    m.error_schedule_total_min({}, { locale }),
  "schedule.total.tooSmall": (p, locale) =>
    m.error_schedule_total_too_small({ count: p.count ?? 0 }, { locale }),
  "schedule.monthly.required": (_p, locale) =>
    m.error_schedule_monthly_required({}, { locale }),
  "schedule.count.range": (_p, locale) =>
    m.error_schedule_count_range({}, { locale }),
  "schedule.firstDue.required": (_p, locale) =>
    m.error_schedule_first_due_required({}, { locale }),
  "date.invalid": (_p, locale) => m.error_date_invalid({}, { locale }),
  "installments.amount.min": (_p, locale) =>
    m.error_installments_amount_min({}, { locale }),
  "amount.tooHigh": (_p, locale) => m.error_amount_too_high({}, { locale }),
  "installments.sum.over": (p, locale) =>
    m.error_installments_sum_over({ diff: money(p.diff, locale) }, { locale }),
  "installments.sum.under": (p, locale) =>
    m.error_installments_sum_under({ diff: money(p.diff, locale) }, { locale }),
  "installments.count.mismatch": (_p, locale) =>
    m.error_installments_count_mismatch({}, { locale }),
  "installments.paid.invalid": (_p, locale) =>
    m.error_installments_paid_invalid({}, { locale }),
  "installments.paid.duplicate": (_p, locale) =>
    m.error_installments_paid_duplicate({}, { locale }),
  "installments.paid.future": (_p, locale) =>
    m.error_installments_paid_future({}, { locale }),
  "counterparty.name.required": (_p, locale) =>
    m.error_counterparty_name_required({}, { locale }),
  "counterparty.name.tooLong": (_p, locale) =>
    m.error_counterparty_name_too_long({}, { locale }),
  "counterparty.email.invalid": (_p, locale) =>
    m.error_counterparty_email_invalid({}, { locale }),
  "counterparty.email.self": (_p, locale) =>
    m.error_counterparty_email_self({}, { locale }),
  "contract.create.failed": (_p, locale) =>
    m.error_contract_create_failed({}, { locale }),
};

const WARNING_TEXT: Record<ContractWarningCode, (locale: Locale) => string> = {
  "installments.date.order": (locale) =>
    m.warning_installments_date_order({}, { locale }),
};

export function errorCodeText(
  code: ContractErrorCode,
  params: CodeParams,
  locale: Locale
): string {
  return ERROR_TEXT[code](params, locale);
}

export function warningCodeText(
  code: ContractWarningCode,
  locale: Locale
): string {
  return WARNING_TEXT[code](locale);
}

/** The numeric diff and count of an API error's details; anything else is ignored. */
export function codeParams(
  details: Record<string, unknown> | undefined
): CodeParams {
  const params: CodeParams = {};
  if (typeof details?.diff === "number") {
    params.diff = details.diff;
  }
  if (typeof details?.count === "number") {
    params.count = details.count;
  }
  return params;
}
