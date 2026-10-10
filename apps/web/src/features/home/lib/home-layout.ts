import type { Locale } from "@quitto/shared";
import { pluralForm } from "@/lib/plural";
import { m } from "@/paraglide/messages.js";
import type { Home } from "../types";
import {
  guideContext,
  type OnboardingView,
  onboardingView,
} from "./onboarding";

export interface HomeLayout {
  allClear: boolean;
  compactGuide: boolean;
  empty: boolean;
  guide: OnboardingView;
  hasContract: boolean;
  heroGuide: boolean;
}

/**
 * Which blocks the home shows. The green guide card leads only when there is
 * no action, so two green cards never stack; with actions the checklist goes
 * compact at the end. "Nada pendente agora" only shows without the green
 * guide card: the guide already answers "what do I do now".
 */
export function homeLayout(home: Home): HomeLayout {
  const guide = onboardingView(home.onboarding, guideContext(home));
  const hasActions = home.actions.length > 0;
  const hasContract = home.onboarding.hasContract;
  const heroGuide = guide.visible && !hasActions;
  return {
    guide,
    hasContract,
    heroGuide,
    compactGuide: guide.visible && hasActions,
    allClear: hasContract && !hasActions && !heroGuide,
    empty: !(hasContract || hasActions || guide.visible),
  };
}

export function homeSubtitle(
  home: Home,
  layout: HomeLayout,
  locale: Locale
): string {
  const options = { locale };
  const count = home.actions.length;
  if (count > 0) {
    return pluralForm(count, locale) === "one"
      ? m.home_subtitle_actions_one({}, options)
      : m.home_subtitle_actions_other({ count }, options);
  }
  return !layout.hasContract && layout.guide.visible
    ? m.home_subtitle_welcome({}, options)
    : m.home_subtitle_clear({}, options);
}
