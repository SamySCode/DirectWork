/**
 * The skills most asked for across the listings already loaded in Discover.
 * Computed client-side from the current page - a "market pulse" with no
 * extra query. It reflects what's loaded, which is the newest listings.
 */
export function topSkills(listings: { skills: string[] }[], limit = 6): string[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const listing of listings) {
    for (const skill of new Set(listing.skills.map((s) => s.trim()))) {
      const key = skill.toLowerCase();
      const entry = counts.get(key) ?? { name: skill, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
  }
  return [...counts.values()]
    .filter((entry) => entry.count >= 2)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((entry) => entry.name);
}
