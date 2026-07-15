const KEY = "quitto:chunk-reloaded";
const PATTERNS = [
  /dynamically imported module/i,
  /Loading chunk .* failed/i,
  /Importing a module script failed/i,
];

/** True quando o erro é falha de carregamento de chunk (import dinâmico stale pós-deploy). */
export function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return PATTERNS.some((re) => re.test(msg));
}

/**
 * Recarrega a página UMA vez em erro de chunk (guarda em storage pra não loopar).
 * @returns true se recarregou.
 */
export function reloadOnceForChunkError(
  error: unknown,
  storage: Storage,
  reload: () => void
): boolean {
  if (!isChunkLoadError(error)) {
    return false;
  }
  if (storage.getItem(KEY)) {
    return false; // já recarregou uma vez → não loopar
  }
  storage.setItem(KEY, "1");
  reload();
  return true;
}

/** Limpa a marca após um load bem-sucedido (permite novo reload no próximo deploy). */
export function clearChunkReloadMark(storage: Storage): void {
  storage.removeItem(KEY);
}
