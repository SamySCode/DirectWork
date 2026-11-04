# CLAUDE.md

Guidance for Claude Code sessions working in this repository. Read
`docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, and `docs/ACCESS_CONTROL.md`
before making structural changes — they capture decisions already agreed,
not just suggestions.

## Product boundary (hard constraint)

DirectWork is a direct professional marketplace, not a social network.
Never add a social feed, general public posts, likes/reactions, follower
counts, or engagement-driven content, even as a small addition to another
feature.

## Architecture rules

- One Expo app for iOS, Android and Web. No separate native apps, no
  separate web codebase, no microservices, no GraphQL, no Elasticsearch,
  no custom ML recommendation engine, no marketplace payments yet.
- Supabase is the backend: Postgres + Auth + Storage + Realtime + RLS +
  Edge Functions. Do not introduce a custom server when Supabase already
  covers the need.
- Sensitive state transitions (application accept/reject, agreement
  acceptance, membership creation) must go through Edge Functions, never
  a direct client-side table write. RLS is the backstop, not the only
  gate. See `docs/ACCESS_CONTROL.md`.
- Feature code lives in `features/<feature>/`; only cross-feature,
  presentation-only UI belongs in `components/`; only cross-feature
  infrastructure belongs in `lib/`.
- Don't hand-pick Expo/Supabase dependency versions — use
  `npx expo install <pkg>` so versions stay compatible with the installed
  Expo SDK.

## Working style

- Preserve existing code; don't replace an established choice without
  explaining why in the response.
- Don't invent product decisions — check `docs/OPEN_DECISIONS.md` first;
  if a needed decision isn't there, surface it instead of assuming.
- Implement one vertical slice at a time (see the order in
  `docs/ARCHITECTURE.md`). Don't build ahead into later slices.
- Run lint, typecheck, and tests for anything changed; report results
  plainly.
- Do not commit, push, or open PRs unless explicitly asked.
- Treat visual reference designs/mockups as directional inspiration for
  tone and layout, not a literal spec — apply engineering judgment on
  what's actually buildable now. Don't add UI for unconfigured providers
  (e.g. OAuth buttons with no provider set up), fields with no backing
  schema yet, or features explicitly deferred to a later slice, just
  because a reference design shows them.
- Prioritize performance, responsiveness, and cost efficiency (query
  volume, Realtime usage, data transfer) over matching every visual or
  feature detail in a reference design. Messaging is deliberately
  deferred (slice 10) for this reason — don't build it out early even if
  a reference design shows it prominently.

<!-- claude-mem-lite:begin v1 -->
## claude-mem-lite — persistent memory

PreToolUse hooks already run `mem_recall` for past lessons before Read/Edit/Write. The calls worth making proactively:

| When | Call |
|------|------|
| Before Edit/Write | hook already recalled; if a `#NN` lesson was injected, cite `#NN` next time you produce user-visible text (citing = adopting the feedback; uncited lessons decay) |
| After fixing a non-trivial bug | `mem_save(type="bugfix", lesson_learned="<root cause + fix>", importance=2)` |
| After a non-obvious architecture decision | `mem_save(type="decision", lesson_learned="<constraint + tradeoff>")` |
| Deferring to a future session | `mem_defer({title, priority:1|2|3, detail})`; when fixed, add `closes_deferred=[N]` to `mem_save` |
| Looking up past work / history | `mem_search "keywords"` · `mem_recent` · `mem_timeline` |

Path cost is round-trips, not milliseconds: the PreToolUse hook above already recalls (0 calls) — prefer it. For an explicit query, if these `mem_*` tools are deferred behind ToolSearch this session, the Bash CLI (exact path in the detail doc) is one call vs two (ToolSearch + call).

Full tool + CLI tables, citation/decay rules, and save discipline → `.claude/plugin_claude_mem_lite.md`
<!-- claude-mem-lite:end -->
