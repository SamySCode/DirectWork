# Task briefs

Each file is one piece of work, sized for a single fresh Claude Code
session on a cheaper model. How to run one is in
`docs/WORKING_WITH_CLAUDE.md`. Short version:

1. `/clear`, then `/model sonnet` (or the model in the table).
2. Say: `Do docs/tasks/T01-design-tokens.md`.
3. When it reports done, check the "Done when" list, then commit.
4. Tick the task off below.

Rules for whoever does a task: read only the files the brief names plus
what you must open to make the change; stay inside the listed files; run
the checks in "Done when"; don't commit unless the owner says so; if the
brief turns out to be wrong or a decision is missing, stop and say so
instead of guessing.

| #   | Task                                         | Model  | Needs               | Status |
| --- | -------------------------------------------- | ------ | ------------------- | ------ |
| T01 | Apply depth tokens to shared components      | Sonnet | -                   | done   |
| T02 | Accessibility: shared components             | Sonnet | T01                 | to do  |
| T03 | Accessibility: automated audit and statement | Sonnet | T02                 | to do  |
| T04 | Expo SDK 58 and over-the-air updates         | Opus   | clean tree          | to do  |
| T05 | Web deploy pipeline (Cloudflare)             | Sonnet | T04                 | to do  |
| T06 | Staging rehearsal checklist                  | Haiku  | owner runs commands | to do  |
| T07 | Founder metrics for the 90-day test          | Sonnet | -                   | to do  |
| T08 | Small fixes batch                            | Haiku  | -                   | done   |
| T09 | Landing page and waitlist                    | Sonnet | owner decision 3    | to do  |
| T10 | Launch videos with Remotion                  | Sonnet | T01                 | to do  |
| T11 | Deal Sheet guidance from competitor review   | Sonnet | -                   | to do  |
| T12 | Test gaps from the QA review                 | Sonnet | -                   | to do  |
| T13 | Online-only launch plan                      | Sonnet | -                   | done   |

After every 2 or 3 tasks, run one review session on the strongest model:
`Review the uncommitted diff against docs/tasks/<file>. Report only real
defects.` Database and security changes (T04, T07, T12) always get that
review before they are applied anywhere.
