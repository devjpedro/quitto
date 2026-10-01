const DIACRITIC_RE = /\p{Diacritic}/gu;
const SPACE_RE = /\s+/g;

/** NFD → remove diacrítico → minúscula → colapsa espaço. Base de toda comparação. */
export function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(DIACRITIC_RE, "")
    .toLowerCase()
    .replace(SPACE_RE, " ")
    .trim();
}

const SCORE_PREFIX = 1;
const SCORE_WORD_START = 0.9;
const SCORE_INFIX = 0.7;
const SCORE_SUBSEQUENCE = 0.4;

/** true quando `needle` aparece como subsequência (letras na ordem, com buracos). */
function isSubsequence(haystack: string, needle: string): boolean {
  let cursor = 0;
  for (const char of haystack) {
    if (char === needle[cursor]) {
      cursor += 1;
      if (cursor === needle.length) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Pontua de 0 (não casa) a 1 (prefixo). Ambos os lados normalizados, então
 * "joao" acha "João" e "emprestimo" acha "Empréstimo".
 */
export function scoreMatch(haystack: string, needle: string): number {
  const target = normalize(haystack);
  const query = normalize(needle);
  if (query === "") {
    return SCORE_PREFIX;
  }
  const at = target.indexOf(query);
  if (at === 0) {
    return SCORE_PREFIX;
  }
  if (at > 0) {
    return target[at - 1] === " " ? SCORE_WORD_START : SCORE_INFIX;
  }
  return isSubsequence(target, query) ? SCORE_SUBSEQUENCE : 0;
}

/**
 * Prop `filter` do cmdk. Pontua SÓ as keywords — o `value` é um uuid e
 * poluiria o score. Todo CommandItem precisa declarar `keywords`.
 */
export function commandFilter(
  _value: string,
  search: string,
  keywords?: string[]
): number {
  if (!keywords || keywords.length === 0) {
    return 0;
  }
  let best = 0;
  for (const keyword of keywords) {
    const score = scoreMatch(keyword, search);
    if (score > best) {
      best = score;
    }
  }
  return best;
}

export interface UrgencyItem {
  nextDueDate: string | null;
  overdueCount: number;
}

/**
 * Ordem do estado vazio: vencidos primeiro; dentro de cada bloco, vencimento
 * mais próximo antes; contrato quitado (`nextDueDate` null) por último.
 * Não muta a entrada.
 */
export function sortByUrgency<T extends UrgencyItem>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => {
    const leftOverdue = left.overdueCount > 0 ? 0 : 1;
    const rightOverdue = right.overdueCount > 0 ? 0 : 1;
    if (leftOverdue !== rightOverdue) {
      return leftOverdue - rightOverdue;
    }
    if (left.nextDueDate === right.nextDueDate) {
      return 0;
    }
    if (left.nextDueDate === null) {
      return 1;
    }
    if (right.nextDueDate === null) {
      return -1;
    }
    return left.nextDueDate < right.nextDueDate ? -1 : 1;
  });
}
