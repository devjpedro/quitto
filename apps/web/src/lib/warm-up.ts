import { api } from "@/lib/api";

// Fly escala a máquina pra zero; o primeiro request do usuário paga o boot.
// Disparamos um ping em background no load pra acordar a API enquanto o
// usuário lê/digita no login. Fire-and-forget: nunca bloqueia nem lança.
export function warmUpApi(): void {
  api.api.ping.get().catch(() => {
    // Silently ignore errors; warm-up is best-effort only.
  });
}
