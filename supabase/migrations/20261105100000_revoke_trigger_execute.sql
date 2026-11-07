-- Leftovers from the hosted project's default privileges, found by the
-- "signed-out visitors can't call any public function or use any
-- sequence" guardrail. Neither was exploitable, but nothing needs them.

-- set_updated_at is a trigger function. Triggers don't check EXECUTE when
-- they fire, so no client role needs it.
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- Status history rows are only written by SECURITY DEFINER functions, which
-- run as the owner, so the client roles never draw from this sequence.
revoke all on sequence public.application_status_history_id_seq from anon, authenticated;
