import { APP_TIME_ZONE } from "@quitto/shared";
import { m } from "@/paraglide/messages.js";

export type PartOfDay = "morning" | "afternoon" | "evening";

const hourFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  hourCycle: "h23",
  timeZone: APP_TIME_ZONE,
});

/** The product's clock is São Paulo's: server and browser agree on the greeting. */
export function partOfDay(nowMs: number): PartOfDay {
  const hour = Number(hourFormatter.format(nowMs));
  if (hour >= 5 && hour < 12) {
    return "morning";
  }
  if (hour >= 12 && hour < 18) {
    return "afternoon";
  }
  return "evening";
}

export function firstName(name: string | null | undefined): string | null {
  const first = name?.trim().split(" ")[0];
  return first ? first : null;
}

const NAMED: Record<PartOfDay, (inputs: { name: string }) => string> = {
  morning: m.home_greeting_morning,
  afternoon: m.home_greeting_afternoon,
  evening: m.home_greeting_evening,
};

const ANONYMOUS: Record<PartOfDay, () => string> = {
  morning: m.home_greeting_morning_anonymous,
  afternoon: m.home_greeting_afternoon_anonymous,
  evening: m.home_greeting_evening_anonymous,
};

export function greetingFor(part: PartOfDay, name: string | null): string {
  return name === null ? ANONYMOUS[part]() : NAMED[part]({ name });
}
