import {
  CalendarBlank,
  Files,
  GearSix,
  type Icon,
  Lightning,
  Users,
} from "@phosphor-icons/react";
import type { SettingsSection } from "@/features/settings/lib/settings-sections";
import { m } from "@/paraglide/messages.js";

export interface PalettePage {
  icon: Icon;
  /** Read on render, so it follows the language. */
  keywords: string[];
  label: () => string;
  to: "/" | "/contracts" | "/installments" | "/people" | "/settings";
}

/**
 * "Ir para": the app's places, with search words in both languages (a person
 * who types "settings" in a Portuguese UI finds Ajustes, and the reverse).
 */
export const PALETTE_PAGES: PalettePage[] = [
  {
    to: "/",
    label: m.nav_now,
    icon: Lightning,
    keywords: ["agora", "now", "inicio", "home", "dashboard"],
  },
  {
    to: "/contracts",
    label: m.nav_contracts,
    icon: Files,
    keywords: ["contratos", "contracts", "lista"],
  },
  {
    to: "/installments",
    label: m.nav_installments,
    icon: CalendarBlank,
    keywords: ["parcelas", "installments", "vencimentos", "due", "calendario"],
  },
  {
    to: "/people",
    label: m.nav_people,
    icon: Users,
    keywords: ["pessoas", "people", "contatos", "contacts"],
  },
  {
    to: "/settings",
    label: m.account_settings,
    icon: GearSix,
    keywords: ["ajustes", "settings", "conta", "account", "configuracoes"],
  },
];

export interface PaletteSettingsSection {
  keywords: string[];
  label: () => string;
  section: SettingsSection;
}

/** The sections of Ajustes, found by what they hold; offered only once something is typed. */
export const PALETTE_SETTINGS: PaletteSettingsSection[] = [
  {
    section: "profile",
    label: m.settings_profile,
    keywords: ["perfil", "profile", "idioma", "language", "tema", "theme"],
  },
  {
    section: "pix",
    label: m.settings_pix,
    keywords: ["pix", "chave", "key", "recebimento", "payments", "qr"],
  },
  {
    section: "reminders",
    label: m.settings_reminders,
    keywords: ["lembretes", "reminders", "email", "e-mail", "avisos"],
  },
  {
    section: "security",
    label: m.settings_security,
    keywords: ["seguranca", "security", "senha", "password"],
  },
  {
    section: "data",
    label: m.settings_data,
    keywords: [
      "dados",
      "data",
      "exportar",
      "export",
      "excluir conta",
      "delete account",
      "lgpd",
    ],
  },
];

export const CREATE_KEYWORDS = [
  "criar contrato",
  "novo contrato",
  "adicionar",
  "create contract",
  "new contract",
];
export const THEME_KEYWORDS = [
  "tema",
  "theme",
  "claro",
  "escuro",
  "dark",
  "light",
  "aparencia",
];
export const SIGN_OUT_KEYWORDS = [
  "sair",
  "logout",
  "sign out",
  "desconectar",
  "encerrar sessao",
];
export const NOTIFICATIONS_KEYWORDS = [
  "notificacoes",
  "notifications",
  "avisos",
  "sino",
  "bell",
];
export const LANGUAGE_KEYWORDS = [
  "idioma",
  "language",
  "english",
  "ingles",
  "portugues",
  "portuguese",
];
