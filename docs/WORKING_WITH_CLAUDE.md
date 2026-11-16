# Working with Claude Code on this project, cheaply

Written 2026-11-16, after one very long session used most of a weekly
allowance. The app is now mostly built; what is left is small, well
defined pieces. This is how to do them without burning usage.

## Why the big session cost so much

- **Every message re-sends the whole conversation.** A session that has
  run for days carries a huge history on every turn, even for a one-line
  question.
- **Many agents at once on the top model.** Twelve reviewers in parallel
  at maximum effort hit the 5-hour limit in about 8 minutes. Each agent
  also re-sends everything it has read on every step.
- **The top model did work a cheaper one could do.** Your usage report
  showed 94% on Opus.

## The routine

One task, one fresh session, the cheapest model that can do it.

1. Pick the next task in `docs/tasks/README.md`.
2. Start clean: `/clear`.
3. Set the model: `/model sonnet` (or what the task says).
4. Say: `Do docs/tasks/T01-design-tokens.md`.
5. When it finishes, say `Use the checker agent` to confirm everything
   passes (it runs on Haiku).
6. Review it yourself in the preview, then say `commit this on a branch`.
7. `/clear` before the next task.

After two or three tasks, or after anything touching the database or
security: `/clear`, `/model opus`, then
`Use the reviewer agent on the uncommitted diff against docs/tasks/<file>`.

## Which model for what

| Work                                                                                                                                        | Model                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Running checks, renaming, copy edits, doc fixes, following a checklist                                                                      | Haiku                                  |
| Building a feature or fix from a written brief; writing tests                                                                               | Sonnet                                 |
| Planning something new, writing a brief, database security rules, the Expo upgrade, final review of a diff, anything legal or money related | Opus (or the strongest model you have) |

A good pattern: spend 10 minutes with the strongest model writing a
brief like the ones in `docs/tasks/` (goal, files, do, don't, done
when), then `/clear` and hand it to Sonnet. Planning is short and
valuable; typing code is long and cheap.

## Using Opus well

- Give it the decision, not the chores. Ask "what should we do about X
  and why", "write a task brief for X", or "review this diff", and stop
  there.
- Point it at files: "read docs/ROADMAP.md and docs/tasks/README.md,
  then …". It should not need to rediscover the project. `CLAUDE.md`,
  `docs/ROADMAP.md`, `docs/NEXT_STEPS.md`, `docs/OPERATIONS.md` and
  `docs/ACCESS_CONTROL.md` hold what earlier sessions learned.
- Keep sessions short. When the topic changes, `/clear`. If you must
  keep going in a long one, `/compact` first.
- Don't ask for "everything" in one message. One outcome per session
  finishes faster, costs less and is easier to check.
- Avoid maximum effort unless the problem is genuinely hard.
- Avoid fleets of agents. If independent checks are wanted, two agents
  on Sonnet are plenty. The three agents in `.claude/agents/` already
  carry the right model: `builder` (Sonnet), `checker` (Haiku),
  `reviewer` (Opus).

## Habits that save the most

1. `/clear` between tasks. This is the single biggest saving.
2. Sonnet by default; switch up only for planning and review.
3. Ask for quiet output: "run the checks and tell me only what failed".
4. Keep decisions in the repo (`docs/OPEN_DECISIONS.md`,
   `docs/ROADMAP.md`), not in the chat, so a new session can read a
   short file instead of a long history.
5. Check `/usage` before starting something large.

## What Claude will not do for you

Claude Code's safety checks stop it from pushing database changes or
settings to a hosted Supabase project, and from committing unless you
ask. Those steps are yours: the exact commands are in
`docs/NEXT_STEPS.md` and `docs/tasks/T06-staging-rehearsal.md`.
