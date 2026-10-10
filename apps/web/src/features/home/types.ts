import type { api } from "@/lib/api";

type HomeResponse = Awaited<ReturnType<typeof api.api.home.get>>;

/** GET /api/home, as the web sees it (types come from the API through Eden). */
export type Home = NonNullable<HomeResponse["data"]>;
export type HomeAction = Home["actions"][number];
export type InstallmentAction = Exclude<HomeAction, { kind: "invite" }>;
export type InviteAction = Extract<HomeAction, { kind: "invite" }>;
export type UpcomingItem = Home["upcoming"]["items"][number];
export type HomeMilestones = Home["milestones"];
export type HomeOnboarding = Home["onboarding"];
