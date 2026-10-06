import { m } from "@/paraglide/messages.js";

/** "chave e-mail", "chave aleatória": the key's kind, above the key itself. */
export function pixKeyTypeLabel(keyType: string): string {
  switch (keyType) {
    case "cpf":
      return m.panel_pix_type_cpf();
    case "cnpj":
      return m.panel_pix_type_cnpj();
    case "phone":
      return m.panel_pix_type_phone();
    case "evp":
      return m.panel_pix_type_evp();
    default:
      return m.panel_pix_type_email();
  }
}
