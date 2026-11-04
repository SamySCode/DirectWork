# supabase/

```
supabase/
  config.toml        # local dev config (auth settings mirror what hosted should use)
  migrations/        # plain SQL, the source of truth for the schema
  functions/
    _shared/http.ts  # CORS, JWT -> user, service client, DB error mapping
    actions/         # the gate for every sensitive state transition
    delete-account/  # in-app account deletion (cancels Stripe first)
    billing/         # Stripe Checkout + customer portal sessions
    billing-webhook/ # Stripe -> public.subscriptions (verify_jwt = false)
  tests/
    db/              # migrations + RLS + transitions in PGlite: npm run test:db
    rls-profiles.mjs # end-to-end check against a deployed project: npm run test:rls:live
```

See `docs/DATA_MODEL.md` for the schema, `docs/ACCESS_CONTROL.md` for the
RLS / Edge Function split, and `docs/LAUNCH.md` for deploying.

## Making someone a reviewer

Listings only go live after review, so at least one reviewer must exist:

```sql
insert into public.admins (user_id) values ('<auth.users id>');
```

Run it in the SQL editor. There's deliberately no in-app way to grant
this.

## Writing a migration

Follow the standing rules in `docs/ACCESS_CONTROL.md`: wrap
`(select auth.uid())`, add explicit grants, and revoke PUBLIC execute on
anything in `private`. Add a negative-case test to `tests/db/db.test.mjs`.
The harness applies every migration in order, so a broken migration fails
the suite immediately.
