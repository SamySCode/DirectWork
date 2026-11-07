import catalog from "./skillCatalog.json";

/**
 * The curated skills list, searched on the device so suggestions are instant,
 * work offline and cost no requests. The same list seeds `public.skills` in
 * 20261107094000_skills_seed_search.sql; a test fails if the two drift.
 * Skills people add themselves still come from the server (searchSkills).
 */
export const SKILL_CATALOG: readonly string[] = catalog.skills;

/** Shorthand people type ("dev", "pm", "ppc") mapped to catalogue skills. */
export const SKILL_ALIASES: Readonly<Record<string, readonly string[]>> = catalog.aliases;

const WORD_SPLIT = /[\s/\-.&()]+/;

/**
 * Ranked, case-insensitive search: exact match, then shorthand, then names
 * starting with the query, then names with a word starting with it, then
 * names containing it. Ties go to the shorter (more general) name.
 */
export function searchCatalog(
  query: string,
  { limit = 8, exclude = [] }: { limit?: number; exclude?: readonly string[] } = {},
): string[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) return [];
  const excluded = new Set(exclude.map((s) => s.toLowerCase()));
  const scores = new Map<string, number>();
  const add = (name: string, score: number) => {
    if (excluded.has(name.toLowerCase())) return;
    const previous = scores.get(name);
    if (previous === undefined || score < previous) scores.set(name, score);
  };

  for (const name of SKILL_ALIASES[q] ?? []) add(name, 1);
  for (const name of SKILL_CATALOG) {
    const n = name.toLowerCase();
    if (n === q) add(name, 0);
    else if (n.startsWith(q)) add(name, 2);
    else if (n.split(WORD_SPLIT).some((word) => word.startsWith(q))) add(name, 3);
    else if (n.includes(q)) add(name, 4);
  }

  return [...scores]
    .sort((a, b) => a[1] - b[1] || a[0].length - b[0].length || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name]) => name);
}
