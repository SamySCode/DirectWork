-- Admins need to list open payment disputes for the moderation queue
-- (app/moderation.tsx reads payment_reports where dispute_status = 'disputed').
-- Until now only the two parties could read payment_reports, so the admin
-- list was always empty. Admins see disputed and resolved reports only; the
-- deal itself is still read through get_deal_for_dispute().
create policy "Admins read disputed payment reports"
  on public.payment_reports for select
  to authenticated
  using (
    dispute_status <> 'none'
    and (select private.is_admin((select auth.uid())))
  );
