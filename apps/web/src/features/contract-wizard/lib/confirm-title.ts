import { m } from "@/paraglide/messages.js";

/**
 * "Quero confirmar cada pagamento" (who receives), or "Renata confirma cada
 * pagamento" (who pays). Before the name is typed, "A outra parte confirma…"
 * with its capital letter, never "a outra parte" opening the sentence.
 */
export function confirmTitle(
  receives: boolean,
  firstName: string | null
): string {
  if (receives) {
    return m.wizard_confirm_receive();
  }
  return firstName
    ? m.wizard_confirm_pay({ name: firstName })
    : m.wizard_confirm_pay_unnamed();
}
