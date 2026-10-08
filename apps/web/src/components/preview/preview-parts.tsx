import { ArrowDownLeft, ArrowUpRight, Eye, User } from "@phosphor-icons/react";
import type { Locale } from "@quitto/shared";
import { DateTile } from "@/components/ui/date-tile";
import { Emphasis } from "@/components/ui/emphasis";
import { InstallmentBar } from "@/components/ui/installment-bar";
import { Money } from "@/components/ui/money";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { PlaceholderBlock } from "@/components/ui/placeholder-block";
import { Tag } from "@/components/ui/tag";
import { weekdayLong } from "@/lib/date-parts";
import { formatDate } from "@/lib/locale-format";
import { m } from "@/paraglide/messages.js";
import type { PreviewModel, PreviewSide } from "./types";

export function SideTag({ side }: { side: PreviewSide }) {
  if (side === "receive") {
    return (
      <Tag tone="brand">
        <ArrowDownLeft aria-hidden="true" size={12} weight="bold" />
        {m.preview_side_receive()}
      </Tag>
    );
  }
  return (
    <Tag tone="sunken">
      {side === "pay" ? (
        <ArrowUpRight aria-hidden="true" size={12} weight="bold" />
      ) : (
        <Eye aria-hidden="true" size={12} weight="bold" />
      )}
      {side === "pay" ? m.preview_side_pay() : m.preview_side_follow()}
    </Tag>
  );
}

export function PersonLine({ model }: { model: PreviewModel }) {
  const { person, side } = model;
  if (!person) {
    return (
      <div className="mt-3.5 flex items-center gap-2">
        <PlaceholderBlock shape="dot" />
        <PlaceholderBlock shape="line">
          {m.preview_placeholder_person()}
        </PlaceholderBlock>
      </div>
    );
  }
  if (person.kind === "solo") {
    return (
      <p className="mt-3.5 flex items-center gap-2 text-[13px] text-ink-muted">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-inset">
          <User aria-hidden="true" size={14} />
        </span>
        {m.preview_person_solo()}
      </p>
    );
  }
  let text = m.preview_person_with({ name: person.name });
  if (side === "receive") {
    text = m.preview_person_pays_you({ name: person.name });
  } else if (side === "pay") {
    text = m.preview_person_you_pay({ name: person.name });
  }
  return (
    <p className="mt-3.5 flex min-w-0 items-center gap-2 text-[13px] text-ink-muted">
      <PersonAvatar name={person.name} />
      <Emphasis className="min-w-0 truncate" strong={person.name} text={text} />
    </p>
  );
}

/** The bar of every installment and its legend: "0 de 12 recebidas" · "termina em 10/10/2027". */
export function PreviewProgress({
  locale,
  model,
}: {
  locale: Locale;
  model: PreviewModel;
}) {
  const legend =
    model.side === "receive"
      ? m.preview_progress_received({ paid: 0, total: model.count })
      : m.preview_progress_paid({ paid: 0, total: model.count });
  return (
    <div className="mt-4">
      <InstallmentBar
        installmentsCount={model.count}
        overdueCount={model.overdueCount}
        paidCount={0}
        statuses={model.statuses}
      />
      <p className="mt-2 flex justify-between gap-2 whitespace-nowrap text-ink-muted text-xs tabular-nums">
        <span>{legend}</span>
        {model.lastDueDate ? (
          <b className="font-medium text-ink">
            {m.preview_ends_on({
              date: formatDate(model.lastDueDate, locale, "short"),
            })}
          </b>
        ) : null}
      </p>
    </div>
  );
}

/** The first 3 installments as "Próximos 30 dias" draws them, and "Mais 9 parcelas, até …". */
export function PreviewRows({
  locale,
  model,
}: {
  locale: Locale;
  model: PreviewModel;
}) {
  const more = model.count - model.rows.length;
  const last = model.lastDueDate
    ? formatDate(model.lastDueDate, locale, "short")
    : "";
  let sign: "+" | "−" | undefined;
  if (model.side === "receive") {
    sign = "+";
  } else if (model.side === "pay") {
    sign = "−";
  }
  return (
    <ol className="mt-4 divide-y divide-divider overflow-hidden rounded-card bg-surface-card">
      {model.rows.map((row) => (
        <li
          className="flex min-h-14 items-center gap-3 py-2 pr-3.5 pl-2"
          key={row.sequence}
        >
          <DateTile iso={row.dueDate} locale={locale} />
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 font-medium text-[13.5px] leading-[1.3]">
              <span className="whitespace-nowrap">
                {m.preview_installment({
                  sequence: row.sequence,
                  count: model.count,
                })}
              </span>
              {row.adjusted ? (
                <Tag tone="highlight">{m.preview_adjusted()}</Tag>
              ) : null}
            </span>
            <span className="mt-0.5 block truncate text-ink-muted text-xs tabular-nums">
              {weekdayLong(row.dueDate, locale)}{" "}
              {m.home_dot_after({
                text: formatDate(row.dueDate, locale, "short"),
              })}
            </span>
          </span>
          <Money
            cents={row.amountCents}
            className={model.side === "receive" ? "text-brand" : undefined}
            sign={sign}
            size="list"
          />
        </li>
      ))}
      {more > 0 ? (
        <li className="flex h-[42px] items-center px-4 text-[12.5px] text-ink-muted tabular-nums">
          {more === 1
            ? m.preview_more_one({ date: last })
            : m.preview_more_other({ count: more, date: last })}
        </li>
      ) : null}
    </ol>
  );
}
