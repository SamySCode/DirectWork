import { readFileSync } from "fs";
import { join } from "path";
import { SKILL_ALIASES, SKILL_CATALOG, searchCatalog } from "../skillCatalog";

describe("skill catalogue search", () => {
  it.each([
    ["engineering", "Software engineering"],
    ["software engineering", "Software engineering"],
    ["development", "Software development"],
    ["design", "Design systems"],
    ["marketing", "Marketing"],
    ["dev", "Software development"],
    ["pm", "Product management"],
    ["eng", "Engineering management"],
  ])("%p suggests %p near the top", (query, expected) => {
    expect(searchCatalog(query).slice(0, 3)).toContain(expected);
  });

  it("matches words inside a name and ignores case and extra spaces", () => {
    expect(searchCatalog("  SOFTWARE   eng ")).toContain("Software engineering");
    expect(searchCatalog("research")).toEqual(expect.arrayContaining(["User research"]));
  });

  it("leaves out skills already chosen and respects the limit", () => {
    expect(searchCatalog("design", { exclude: ["Design systems"] })).not.toContain(
      "Design systems",
    );
    expect(searchCatalog("a", { limit: 5 })).toHaveLength(5);
    expect(searchCatalog("   ")).toEqual([]);
  });

  it("has no duplicates and every alias points at a real skill", () => {
    const lower = SKILL_CATALOG.map((s) => s.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
    for (const targets of Object.values(SKILL_ALIASES)) {
      for (const target of targets) expect(SKILL_CATALOG).toContain(target);
    }
  });

  it("matches the database seed exactly (one source of truth)", () => {
    const sql = readFileSync(
      join(__dirname, "../../../supabase/migrations/20261107094000_skills_seed_search.sql"),
      "utf8",
    );
    const seed = sql.slice(sql.indexOf("unnest(array["), sql.indexOf("]) as n"));
    const seeded = [...seed.matchAll(/'((?:[^']|'')*)'/g)].map((m) =>
      (m[1] ?? "").replace(/''/g, "'"),
    );
    expect([...seeded].sort()).toEqual([...SKILL_CATALOG].sort());
  });
});
