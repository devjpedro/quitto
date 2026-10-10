import { useIdentity } from "@/hooks/use-identity";
import { firstName, greetingFor, partOfDay } from "../lib/greeting";

/** "Bom dia, João", with the name the shell already knows (identity cookie or /me), no request of its own. */
export function useGreeting(): string {
  const identity = useIdentity();
  return greetingFor(partOfDay(Date.now()), firstName(identity?.name));
}
