const DIACRITICS_REGEX = new RegExp('[\\u0300-\\u036f]', 'g');

/**
 * Normaliza el nombre de un platillo a una cache key determinista.
 * Asume que la misma normalización identifica la misma receta —
 * no distingue variaciones de proporciones entre una preparación y otra
 * (ver CLAUDE.md → "Decisiones abiertas").
 */
export function normalizeBatchName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS_REGEX, '') // quita acentos (diacríticos tras NFD)
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}
