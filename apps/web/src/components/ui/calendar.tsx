import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { DayPicker, type PropsBase, type PropsSingle } from "react-day-picker";
import { cn } from "@/lib/utils";

/** Single-select calendar props (mode is fixed to "single" internally). */
export type CalendarProps = PropsBase & Omit<PropsSingle, "mode">;

const captionFmt = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});
const weekdayFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });

/** pt-BR formatters backed by Intl (no date-fns). */
const formatters = {
  formatCaption: (month: Date) => {
    const label = captionFmt.format(month);
    return label.charAt(0).toUpperCase() + label.slice(1);
  },
  formatWeekdayName: (weekday: Date) =>
    weekdayFmt.format(weekday).replace(".", ""),
};

function Chevron({
  orientation,
}: {
  orientation?: "left" | "right" | "up" | "down";
}) {
  // DayPicker only ever passes "left" or "right"; up/down default to ChevronRight.
  const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
  return <Icon className="size-4" />;
}

/** shadcn-styled single-select month calendar (react-day-picker), localized pt-BR. */
export function Calendar({ className, classNames, ...props }: CalendarProps) {
  const mergedClassNames = useMemo(
    () => ({
      months: "relative",
      month: "space-y-3",
      month_caption: "flex h-8 items-center justify-center",
      caption_label: "font-medium text-sm capitalize",
      nav: "absolute top-0 flex w-full items-center justify-between",
      button_previous:
        "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40",
      button_next:
        "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40",
      month_grid: "w-full border-collapse",
      weekdays: "flex",
      weekday:
        "w-9 text-center font-normal text-muted-foreground text-xs capitalize",
      week: "mt-1 flex",
      day: "size-9 p-0 text-center text-sm",
      day_button:
        "inline-flex size-9 items-center justify-center rounded-md font-normal transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      selected:
        "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground",
      today: "[&>button]:font-semibold [&>button]:text-primary",
      outside: "[&>button]:text-muted-foreground/50",
      disabled: "[&>button]:opacity-40 [&>button]:pointer-events-none",
      ...classNames,
    }),
    [classNames]
  );

  // Assembled and annotated as the single-select branch of DayPicker's
  // discriminated union: spreading the bare union (or an object whose `mode`
  // widens to `Mode`) doesn't narrow, so we pin it to PropsBase & PropsSingle.
  const dayPickerProps: PropsBase & PropsSingle = {
    ...props,
    mode: "single",
    showOutsideDays: true,
    className: cn("text-foreground", className),
    classNames: mergedClassNames,
    components: { Chevron },
    formatters,
  };

  return <DayPicker {...dayPickerProps} />;
}
