# T09: Landing page and waitlist

**Model:** Sonnet. **Size:** one session. **Blocked on:** owner decision
3 in `docs/ROADMAP.md` (collect emails, or link straight to sign-up).

## Goal

A public page that explains DirectWork and captures interest before
January.

## Read first

`docs/marketing/landing-page.html` (the draft),
`docs/marketing/messaging.md` (its claims checklist is binding), and
`docs/marketing/competitors.md` section 6a (the three messages).

## Do

- If the decision is "link to sign-up": make the draft the content of a
  static page deployed with the web app, with the call to action going
  to `/sign-up`.
- If the decision is "collect emails": add a `waitlist` table (email,
  created_at, the consent wording version). Insert only through a server
  function with rate limiting. Show an unticked consent box and store
  the exact wording. Add a line to the privacy notice, a retention rule
  (delete 90 days after launch) and an unsubscribe route. The app sends
  no email; the owner exports the list and writes from their own
  mailbox. Change the "no communications" guard test only if it must
  change, and say why.
- Use only claims the messaging checklist allows. Label any Deal Sheet
  image as an illustration.

## Done when

`npm run check` passes, the page works at phone width and in dark mode,
and axe reports no serious violations on it.
