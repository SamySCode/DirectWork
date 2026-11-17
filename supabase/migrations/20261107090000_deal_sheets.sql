-- Deal Sheets and the "pays on time" record (docs/specs/deal-sheet.md).
-- Standing rules (docs/ACCESS_CONTROL.md): revoke then grant on every new
-- table and function (the hosted project auto-grants new public objects to
-- anon and authenticated), wrap (select auth.uid()) in policies, and route
-- every write through the actions Edge Function -> public.svc_* (service_role
-- only) -> private.* functions that take p_actor and authorise.
--
-- Free text here skips the contact rule: Deal Sheets only exist once an
-- application is accepted, when contact details are already shared. Length
-- and blank checks still apply.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table public.deal_sheets (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null unique references public.project_memberships (id) on delete cascade,
  version integer not null default 1 check (version >= 1),
  proposed_by uuid not null references public.profiles (id) on delete cascade,
  scope text not null,
  pay_basis text not null check (pay_basis in ('fixed', 'hourly', 'daily', 'equity', 'mixed')),
  amount numeric check (amount is null or (amount >= 0 and amount <= 100000000)),
  currency text not null default 'GBP' check (currency in ('GBP', 'EUR', 'USD')),
  payment_terms_days integer not null default 14 check (payment_terms_days between 0 and 120),
  milestones jsonb not null default '[]'::jsonb check (
    jsonb_typeof(milestones) = 'array' and jsonb_array_length(milestones) <= 12
  ),
  ip_terms text not null check (ip_terms in ('client_owns_on_payment', 'creator_licence', 'joint', 'other')),
  ip_notes text check (char_length(ip_notes) <= 500),
  equity_percent numeric check (equity_percent > 0 and equity_percent <= 100),
  vesting_months integer check (vesting_months between 0 and 120),
  cliff_months integer check (cliff_months between 0 and 120),
  decision_rights text check (char_length(decision_rights) <= 500),
  owner_business boolean not null default false,
  member_business boolean not null default false,
  owner_confirmed_version integer,
  member_confirmed_version integer,
  agreed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deal_sheets_scope_length check (char_length(scope) between 20 and 2000),
  constraint deal_sheets_cliff_within_vesting check (
    cliff_months is null or vesting_months is null or cliff_months <= vesting_months
  ),
  constraint deal_sheets_confirmations check (
    owner_confirmed_version <= version and member_confirmed_version <= version
  ),
  -- Agreed means both sides confirmed the current version.
  constraint deal_sheets_agreed check (
    agreed_at is null or (owner_confirmed_version = version and member_confirmed_version = version)
  )
);

create index deal_sheets_proposed_by_idx on public.deal_sheets (proposed_by);

create trigger deal_sheets_set_updated_at
  before update on public.deal_sheets
  for each row
  execute function public.set_updated_at();

create table public.payment_reports (
  id uuid primary key default gen_random_uuid(),
  deal_sheet_id uuid not null references public.deal_sheets (id) on delete cascade,
  milestone_index integer check (milestone_index between 0 and 11),
  outcome text not null check (outcome in ('on_time', 'late', 'unpaid')),
  paid_on date,
  reported_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  dispute_status text not null default 'none'
    check (dispute_status in ('none', 'disputed', 'upheld', 'rejected')),
  dispute_reason text check (char_length(dispute_reason) <= 500),
  disputed_at timestamptz,
  resolved_at timestamptz,
  constraint payment_reports_paid_on check (
    (outcome = 'late' and paid_on is not null)
    or (outcome = 'unpaid' and paid_on is null)
    or outcome = 'on_time'
  ),
  constraint payment_reports_dispute check (
    (dispute_status = 'none' and dispute_reason is null and disputed_at is null and resolved_at is null)
    or (dispute_status = 'disputed' and dispute_reason is not null and disputed_at is not null and resolved_at is null)
    or (dispute_status in ('upheld', 'rejected') and dispute_reason is not null and resolved_at is not null)
  )
);

-- One report per milestone, or one per deal when it has no milestones.
create unique index payment_reports_one_per_milestone
  on public.payment_reports (deal_sheet_id, coalesce(milestone_index, -1));
create index payment_reports_reported_by_idx on public.payment_reports (reported_by);

create trigger payment_reports_set_updated_at
  before update on public.payment_reports
  for each row
  execute function public.set_updated_at();

-- The admin's resolution note, kept out of the client-readable table.
create table private.payment_dispute_resolutions (
  report_id uuid primary key references public.payment_reports (id) on delete cascade,
  resolved_by uuid references auth.users (id) on delete set null,
  upheld boolean not null,
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

create index payment_dispute_resolutions_resolved_by_idx
  on private.payment_dispute_resolutions (resolved_by);

-- Which payment_due notices went out, so the daily job tells people once.
-- milestone_index -1 = the whole deal (no milestones).
create table private.payment_due_notices (
  deal_sheet_id uuid not null references public.deal_sheets (id) on delete cascade,
  milestone_index integer not null,
  sent_on date not null,
  primary key (deal_sheet_id, milestone_index)
);

revoke all on private.payment_dispute_resolutions, private.payment_due_notices
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Read access: the two parties only. Admins go through
-- get_deal_for_dispute().
-- ---------------------------------------------------------------------------
create function private.is_membership_party(p_membership uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.project_memberships m
    join public.projects p on p.id = m.project_id
    where m.id = p_membership and p_user in (m.user_id, p.owner_id)
  );
$$;

revoke execute on function private.is_membership_party(uuid, uuid) from public, anon;
grant execute on function private.is_membership_party(uuid, uuid) to authenticated, service_role;

alter table public.deal_sheets enable row level security;
alter table public.payment_reports enable row level security;

create policy "The two parties read their deal sheet"
  on public.deal_sheets for select
  to authenticated
  using (private.is_membership_party(membership_id, (select auth.uid())));

create policy "Payment reports follow deal sheet visibility"
  on public.payment_reports for select
  to authenticated
  using (exists (select 1 from public.deal_sheets d where d.id = deal_sheet_id));

revoke all on public.deal_sheets, public.payment_reports from anon, authenticated, service_role;
grant select on public.deal_sheets, public.payment_reports to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Activity kinds
-- ---------------------------------------------------------------------------
alter table public.activity drop constraint activity_kind_check;
alter table public.activity add constraint activity_kind_check check (kind in (
  'application_received', 'application_accepted', 'application_declined', 'application_closed',
  'listing_published', 'listing_changes_requested',
  'outcome_to_confirm', 'outcome_confirmed', 'reference_received',
  'question_asked', 'question_answered',
  'deal_proposed', 'deal_agreed', 'payment_due', 'payment_reported',
  'payment_disputed', 'payment_dispute_resolved'
));

-- ---------------------------------------------------------------------------
-- 4. Helpers
-- ---------------------------------------------------------------------------

-- Payment due date: the milestone's date, or (no milestones) the agreed
-- date in UK time plus the payment terms.
create function private.payment_due_date(p_deal public.deal_sheets, p_milestone integer)
returns date
language sql
stable
set search_path = ''
as $$
  select case
    when p_milestone is null
      then (p_deal.agreed_at at time zone 'Europe/London')::date + p_deal.payment_terms_days
    else (p_deal.milestones -> p_milestone ->> 'due_date')::date
  end;
$$;

create function private.uk_today()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Europe/London')::date; $$;

-- Optional free text: trimmed, blank -> null, length-checked.
create function private.optional_text(p_text text, p_max integer, p_label text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_text text := private.trim_text(p_text);
begin
  if v_text is null or private.visible_length(v_text) = 0 then
    return null;
  end if;
  if char_length(v_text) > p_max then
    raise exception '% can be at most % characters', p_label, p_max using errcode = '22023';
  end if;
  return v_text;
end;
$$;

revoke execute on function private.payment_due_date(public.deal_sheets, integer) from public, anon, authenticated;
revoke execute on function private.uk_today() from public, anon, authenticated;
revoke execute on function private.optional_text(text, integer, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Transitions (private, p_actor, authorised here)
-- ---------------------------------------------------------------------------

-- Insert or bump the version. Any change clears both confirmations; the
-- proposer is taken to confirm their own version.
create function private.propose_deal(p_actor uuid, p_membership uuid, p_business boolean, p_sheet jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.project_memberships%rowtype;
  v_owner uuid;
  v_is_owner boolean;
  v_deal public.deal_sheets%rowtype;
  v_scope text;
  v_pay_basis text;
  v_amount numeric;
  v_currency text;
  v_terms integer;
  v_milestones jsonb := '[]'::jsonb;
  v_item jsonb;
  v_title text;
  v_due date;
  v_item_amount numeric;
  v_ip_terms text;
  v_ip_notes text;
  v_equity numeric;
  v_vesting integer;
  v_cliff integer;
  v_rights text;
  v_id uuid;
begin
  select * into v_m from public.project_memberships where id = p_membership for update;
  if found then
    select owner_id into v_owner from public.projects where id = v_m.project_id;
  end if;
  if not found or p_actor is null or p_actor not in (v_owner, v_m.user_id)
    or private.blocked_between(v_owner, v_m.user_id) then
    raise exception 'Collaboration not found' using errcode = 'P0002';
  end if;
  v_is_owner := p_actor = v_owner;

  if p_sheet is null or jsonb_typeof(p_sheet) <> 'object' then
    raise exception 'Missing deal sheet' using errcode = '22023';
  end if;

  begin
    v_scope := private.trim_text(p_sheet ->> 'scope');
    if private.visible_length(v_scope) < 20 or char_length(v_scope) > 2000 then
      raise exception 'The scope needs 20 to 2,000 characters' using errcode = '22023';
    end if;

    v_pay_basis := p_sheet ->> 'pay_basis';
    if v_pay_basis is null or v_pay_basis not in ('fixed', 'hourly', 'daily', 'equity', 'mixed') then
      raise exception 'Choose how the work is paid' using errcode = '22023';
    end if;
    v_amount := (p_sheet ->> 'amount')::numeric;
    if v_amount is not null and (v_amount < 0 or v_amount > 100000000) then
      raise exception 'Enter an amount between 0 and 100,000,000' using errcode = '22023';
    end if;
    v_currency := coalesce(p_sheet ->> 'currency', 'GBP');
    if v_currency not in ('GBP', 'EUR', 'USD') then
      raise exception 'Currency must be GBP, EUR or USD' using errcode = '22023';
    end if;
    v_terms := coalesce((p_sheet ->> 'payment_terms_days')::integer, 14);
    if v_terms not between 0 and 120 then
      raise exception 'Payment terms must be 0 to 120 days' using errcode = '22023';
    end if;

    if p_sheet -> 'milestones' is not null and jsonb_typeof(p_sheet -> 'milestones') <> 'null' then
      if jsonb_typeof(p_sheet -> 'milestones') <> 'array' then
        raise exception 'Milestones must be a list' using errcode = '22023';
      end if;
      if jsonb_array_length(p_sheet -> 'milestones') > 12 then
        raise exception 'A deal sheet can have at most 12 milestones' using errcode = '22023';
      end if;
      for v_item in select value from jsonb_array_elements(p_sheet -> 'milestones') loop
        if jsonb_typeof(v_item) <> 'object' then
          raise exception 'Each milestone needs a title and a due date' using errcode = '22023';
        end if;
        v_title := private.trim_text(v_item ->> 'title');
        if private.visible_length(v_title) = 0 or char_length(v_title) > 120 then
          raise exception 'Each milestone needs a title of up to 120 characters' using errcode = '22023';
        end if;
        if coalesce(v_item ->> 'due_date', '') !~ '^\d{4}-\d{2}-\d{2}$' then
          raise exception 'Each milestone needs a due date' using errcode = '22023';
        end if;
        v_due := (v_item ->> 'due_date')::date;
        v_item_amount := (v_item ->> 'amount')::numeric;
        if v_item_amount is not null and (v_item_amount < 0 or v_item_amount > 100000000) then
          raise exception 'Enter a milestone amount between 0 and 100,000,000' using errcode = '22023';
        end if;
        v_milestones := v_milestones || jsonb_build_array(jsonb_build_object(
          'title', v_title, 'due_date', to_char(v_due, 'YYYY-MM-DD'), 'amount', v_item_amount
        ));
      end loop;
    end if;

    v_ip_terms := p_sheet ->> 'ip_terms';
    if v_ip_terms is null or v_ip_terms not in ('client_owns_on_payment', 'creator_licence', 'joint', 'other') then
      raise exception 'Choose who owns the work' using errcode = '22023';
    end if;
    v_ip_notes := private.optional_text(p_sheet ->> 'ip_notes', 500, 'IP notes');
    if v_ip_terms = 'other' and v_ip_notes is null then
      raise exception 'Describe the IP terms in the notes' using errcode = '22023';
    end if;

    v_equity := (p_sheet ->> 'equity_percent')::numeric;
    v_vesting := (p_sheet ->> 'vesting_months')::integer;
    v_cliff := (p_sheet ->> 'cliff_months')::integer;
    v_rights := private.optional_text(p_sheet ->> 'decision_rights', 500, 'Decision rights');
  exception
    when invalid_text_representation or invalid_datetime_format or datetime_field_overflow
      or numeric_value_out_of_range then
      raise exception 'Some deal sheet values are not valid' using errcode = '22023';
  end;

  if v_m.role <> 'partner'
    and (v_equity is not null or v_vesting is not null or v_cliff is not null or v_rights is not null) then
    raise exception 'Equity terms are only for partner collaborations' using errcode = '22023';
  end if;
  if v_equity is not null and (v_equity <= 0 or v_equity > 100) then
    raise exception 'Equity must be more than 0 and at most 100%%' using errcode = '22023';
  end if;
  if (v_vesting is not null and v_vesting not between 0 and 120)
    or (v_cliff is not null and v_cliff not between 0 and 120) then
    raise exception 'Vesting and cliff must be 0 to 120 months' using errcode = '22023';
  end if;
  if v_cliff > v_vesting then
    raise exception 'The cliff can''t be longer than the vesting period' using errcode = '22023';
  end if;

  select * into v_deal from public.deal_sheets where membership_id = p_membership for update;
  if not found then
    insert into public.deal_sheets (
      membership_id, version, proposed_by, scope, pay_basis, amount, currency, payment_terms_days,
      milestones, ip_terms, ip_notes, equity_percent, vesting_months, cliff_months, decision_rights,
      owner_business, member_business, owner_confirmed_version, member_confirmed_version
    ) values (
      p_membership, 1, p_actor, v_scope, v_pay_basis, v_amount, v_currency, v_terms,
      v_milestones, v_ip_terms, v_ip_notes, v_equity, v_vesting, v_cliff, v_rights,
      v_is_owner and coalesce(p_business, false), not v_is_owner and coalesce(p_business, false),
      case when v_is_owner then 1 end, case when v_is_owner then null else 1 end
    )
    returning id into v_id;
    return v_id;
  end if;

  -- Reports point at milestones by position; changing the terms underneath
  -- them would rewrite what was reported.
  if exists (select 1 from public.payment_reports where deal_sheet_id = v_deal.id) then
    raise exception 'A payment has been reported on this deal sheet, so it can''t be changed'
      using errcode = 'P0001';
  end if;

  update public.deal_sheets set
    version = v_deal.version + 1,
    proposed_by = p_actor,
    scope = v_scope,
    pay_basis = v_pay_basis,
    amount = v_amount,
    currency = v_currency,
    payment_terms_days = v_terms,
    milestones = v_milestones,
    ip_terms = v_ip_terms,
    ip_notes = v_ip_notes,
    equity_percent = v_equity,
    vesting_months = v_vesting,
    cliff_months = v_cliff,
    decision_rights = v_rights,
    owner_business = case when v_is_owner then coalesce(p_business, false) else owner_business end,
    member_business = case when v_is_owner then member_business else coalesce(p_business, false) end,
    owner_confirmed_version = case when v_is_owner then v_deal.version + 1 end,
    member_confirmed_version = case when v_is_owner then null else v_deal.version + 1 end,
    agreed_at = null
  where id = v_deal.id;
  delete from private.payment_due_notices where deal_sheet_id = v_deal.id;
  return v_deal.id;
end;
$$;

create function private.confirm_deal(p_actor uuid, p_deal uuid, p_version integer, p_business boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deal public.deal_sheets%rowtype;
  v_m public.project_memberships%rowtype;
  v_owner uuid;
  v_is_owner boolean;
  v_mine integer;
  v_theirs integer;
  v_business boolean;
begin
  select * into v_deal from public.deal_sheets where id = p_deal for update;
  if found then
    select * into v_m from public.project_memberships where id = v_deal.membership_id;
    select owner_id into v_owner from public.projects where id = v_m.project_id;
  end if;
  if v_deal.id is null or p_actor is null or p_actor not in (v_owner, v_m.user_id)
    or private.blocked_between(v_owner, v_m.user_id) then
    raise exception 'Deal sheet not found' using errcode = 'P0002';
  end if;
  if p_version is distinct from v_deal.version then
    raise exception 'DEAL_CHANGED: This deal sheet has changed. Review the latest version'
      using errcode = 'P0001';
  end if;
  v_is_owner := p_actor = v_owner;
  v_mine := case when v_is_owner then v_deal.owner_confirmed_version else v_deal.member_confirmed_version end;
  v_theirs := case when v_is_owner then v_deal.member_confirmed_version else v_deal.owner_confirmed_version end;
  v_business := case when v_is_owner then v_deal.owner_business else v_deal.member_business end;

  if v_mine = v_deal.version then
    if v_business = coalesce(p_business, false) then
      return;
    end if;
    if v_deal.agreed_at is not null then
      raise exception 'This deal sheet is already agreed. Propose a new version to change it'
        using errcode = 'P0001';
    end if;
  end if;

  update public.deal_sheets set
    owner_confirmed_version = case when v_is_owner then v_deal.version else owner_confirmed_version end,
    member_confirmed_version = case when v_is_owner then member_confirmed_version else v_deal.version end,
    owner_business = case when v_is_owner then coalesce(p_business, false) else owner_business end,
    member_business = case when v_is_owner then member_business else coalesce(p_business, false) end,
    agreed_at = case when v_theirs = v_deal.version then coalesce(agreed_at, now()) end
  where id = p_deal;
end;
$$;

-- The professional records whether a payment arrived. Only on an agreed
-- deal, only after the due date, one per milestone (or per deal), and
-- correctable by them for 14 days while undisputed.
create function private.report_payment(
  p_actor uuid, p_deal uuid, p_milestone integer, p_outcome text, p_paid_on date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deal public.deal_sheets%rowtype;
  v_m public.project_memberships%rowtype;
  v_count integer;
  v_due date;
  v_existing public.payment_reports%rowtype;
  v_id uuid;
begin
  select * into v_deal from public.deal_sheets where id = p_deal for update;
  if found then
    select * into v_m from public.project_memberships where id = v_deal.membership_id;
  end if;
  if v_deal.id is null or p_actor is null or not private.is_membership_party(v_deal.membership_id, p_actor) then
    raise exception 'Deal sheet not found' using errcode = 'P0002';
  end if;
  if p_actor <> v_m.user_id then
    raise exception 'Only the professional can report a payment' using errcode = '42501';
  end if;
  if v_deal.agreed_at is null then
    raise exception 'Payments can be reported once you''ve both agreed the deal sheet' using errcode = 'P0001';
  end if;
  if v_deal.pay_basis = 'equity' then
    raise exception 'Equity-only deals have no payments to report' using errcode = 'P0001';
  end if;
  if p_outcome is null or p_outcome not in ('on_time', 'late', 'unpaid') then
    raise exception 'Unknown payment outcome' using errcode = '22023';
  end if;

  v_count := jsonb_array_length(v_deal.milestones);
  if v_count = 0 and p_milestone is not null then
    raise exception 'This deal sheet has no milestones' using errcode = '22023';
  end if;
  if v_count > 0 and (p_milestone is null or p_milestone < 0 or p_milestone >= v_count) then
    raise exception 'Choose which milestone was paid' using errcode = '22023';
  end if;

  v_due := private.payment_due_date(v_deal, p_milestone);
  if private.uk_today() <= v_due then
    raise exception 'NOT_DUE_YET: You can report this payment after its due date' using errcode = 'P0001';
  end if;

  if p_outcome = 'unpaid' and p_paid_on is not null then
    raise exception 'An unpaid payment has no paid date' using errcode = '22023';
  end if;
  if p_outcome = 'late' and (p_paid_on is null or p_paid_on <= v_due) then
    raise exception 'A late payment needs the date it arrived, after the due date' using errcode = '22023';
  end if;
  if p_outcome = 'on_time' and p_paid_on > v_due then
    raise exception 'That date is after the due date, so the payment was late' using errcode = '22023';
  end if;
  if p_paid_on > private.uk_today() then
    raise exception 'The paid date can''t be in the future' using errcode = '22023';
  end if;

  select * into v_existing from public.payment_reports
    where deal_sheet_id = p_deal and coalesce(milestone_index, -1) = coalesce(p_milestone, -1)
    for update;
  if not found then
    insert into public.payment_reports (deal_sheet_id, milestone_index, outcome, paid_on, reported_by)
      values (p_deal, p_milestone, p_outcome, p_paid_on, p_actor)
      returning id into v_id;
    return v_id;
  end if;

  if v_existing.dispute_status <> 'none' then
    raise exception 'This report is disputed, so it can''t be changed' using errcode = 'P0001';
  end if;
  if v_existing.created_at < now() - interval '14 days' then
    raise exception 'Reports can only be corrected within 14 days' using errcode = 'P0001';
  end if;
  if v_existing.outcome = p_outcome and v_existing.paid_on is not distinct from p_paid_on then
    return v_existing.id;
  end if;
  update public.payment_reports set outcome = p_outcome, paid_on = p_paid_on where id = v_existing.id;
  return v_existing.id;
end;
$$;

-- The owner disputes a report within 14 days of it being made (or last
-- corrected). Disputed reports drop out of the record until resolved.
create function private.dispute_payment(p_actor uuid, p_report uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.payment_reports%rowtype;
  v_membership uuid;
  v_owner uuid;
  v_reason text := private.trim_text(p_reason);
begin
  select * into v_report from public.payment_reports where id = p_report for update;
  if found then
    select d.membership_id, p.owner_id into v_membership, v_owner
    from public.deal_sheets d
    join public.project_memberships m on m.id = d.membership_id
    join public.projects p on p.id = m.project_id
    where d.id = v_report.deal_sheet_id;
  end if;
  if v_report.id is null or p_actor is null or not private.is_membership_party(v_membership, p_actor) then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;
  if p_actor <> v_owner then
    raise exception 'Only the client can dispute a payment report' using errcode = '42501';
  end if;
  if v_report.dispute_status <> 'none' then
    raise exception 'This report has already been disputed' using errcode = 'P0001';
  end if;
  if v_report.updated_at < now() - interval '14 days' then
    raise exception 'Reports can only be disputed within 14 days' using errcode = 'P0001';
  end if;
  if private.visible_length(v_reason) < 20 or char_length(v_reason) > 500 then
    raise exception 'Give a reason of 20 to 500 characters' using errcode = '22023';
  end if;
  update public.payment_reports
    set dispute_status = 'disputed', dispute_reason = v_reason, disputed_at = now()
    where id = p_report;
end;
$$;

-- Admins only. Upheld = the report is removed from the record; rejected =
-- it counts again.
create function private.resolve_payment_dispute(p_actor uuid, p_report uuid, p_uphold boolean, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.payment_reports%rowtype;
begin
  if p_actor is null or not private.is_admin(p_actor) then
    raise exception 'Only reviewers can do this' using errcode = '42501';
  end if;
  if p_uphold is null then
    raise exception 'Choose whether to uphold the dispute' using errcode = '22023';
  end if;
  select * into v_report from public.payment_reports where id = p_report for update;
  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;
  if v_report.dispute_status <> 'disputed' then
    raise exception 'This dispute has already been handled' using errcode = 'P0001';
  end if;
  update public.payment_reports
    set dispute_status = case when p_uphold then 'upheld' else 'rejected' end, resolved_at = now()
    where id = p_report;
  insert into private.payment_dispute_resolutions (report_id, resolved_by, upheld, note)
    values (p_report, p_actor, p_uphold, private.optional_text(p_note, 1000, 'The note'));
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Read-side RPCs
-- ---------------------------------------------------------------------------

-- Fact-only counts of professionals' reports about an owner. Counts only
-- agreed deals, undisputed (or dispute rejected) reports, and reporters whose
-- account was 14+ days old when the deal was agreed. Nothing until 3 count.
create function public.get_pay_record(p_owner uuid)
returns table (counted integer, on_time integer, late integer, unpaid integer)
language sql
stable
security definer
set search_path = ''
as $$
  with counted as (
    select r.outcome
    from public.payment_reports r
    join public.deal_sheets d on d.id = r.deal_sheet_id
    join public.project_memberships m on m.id = d.membership_id
    join public.projects p on p.id = m.project_id
    join public.profiles reporter on reporter.id = r.reported_by
    where p.owner_id = p_owner
      and (select auth.uid()) is not null
      and r.reported_by = m.user_id
      and r.dispute_status in ('none', 'rejected')
      and d.agreed_at is not null
      and d.owner_confirmed_version = d.version
      and d.member_confirmed_version = d.version
      and reporter.created_at <= d.agreed_at - interval '14 days'
  )
  select * from (
    select
      count(*)::integer,
      (count(*) filter (where outcome = 'on_time'))::integer,
      (count(*) filter (where outcome = 'late'))::integer,
      (count(*) filter (where outcome = 'unpaid'))::integer
    from counted
  ) t (counted, on_time, late, unpaid)
  where t.counted >= 3;
$$;

revoke execute on function public.get_pay_record(uuid) from public, anon;
grant execute on function public.get_pay_record(uuid) to authenticated;

-- Admin view of a disputed payment: the deal sheet and the report. Nothing
-- for anyone else (same answer as a missing report).
create function public.get_deal_for_dispute(p_report uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('deal', to_jsonb(d), 'report', to_jsonb(r))
  from public.payment_reports r
  join public.deal_sheets d on d.id = r.deal_sheet_id
  where r.id = p_report and private.is_admin((select auth.uid()));
$$;

revoke execute on function public.get_deal_for_dispute(uuid) from public, anon;
grant execute on function public.get_deal_for_dispute(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Activity
-- ---------------------------------------------------------------------------
create function private.activity_from_deal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid;
  v_owner uuid;
  v_project uuid;
  v_application uuid;
begin
  select m.user_id, p.owner_id, p.id, m.application_id into v_member, v_owner, v_project, v_application
  from public.project_memberships m join public.projects p on p.id = m.project_id
  where m.id = new.membership_id;

  if tg_op = 'INSERT' or new.version <> old.version then
    perform private.notify(
      case when new.proposed_by = v_owner then v_member else v_owner end,
      'deal_proposed', new.proposed_by, v_project, v_application, new.membership_id
    );
  end if;
  if new.agreed_at is not null and (tg_op = 'INSERT' or old.agreed_at is null) then
    perform private.notify(v_member, 'deal_agreed', v_owner, v_project, v_application, new.membership_id);
    perform private.notify(v_owner, 'deal_agreed', v_member, v_project, v_application, new.membership_id);
  end if;
  return null;
end;
$$;

create trigger deal_sheets_activity
  after insert or update on public.deal_sheets
  for each row execute function private.activity_from_deal();

create function private.activity_from_payment_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid;
  v_owner uuid;
  v_project uuid;
  v_application uuid;
  v_membership uuid;
begin
  select m.user_id, p.owner_id, p.id, m.application_id, m.id
    into v_member, v_owner, v_project, v_application, v_membership
  from public.deal_sheets d
  join public.project_memberships m on m.id = d.membership_id
  join public.projects p on p.id = m.project_id
  where d.id = new.deal_sheet_id;

  if tg_op = 'INSERT'
    or new.outcome is distinct from old.outcome or new.paid_on is distinct from old.paid_on then
    perform private.notify(v_owner, 'payment_reported', v_member, v_project, v_application, v_membership);
  end if;
  if tg_op = 'UPDATE' and new.dispute_status <> old.dispute_status then
    if new.dispute_status = 'disputed' then
      perform private.notify(v_member, 'payment_disputed', v_owner, v_project, v_application, v_membership);
    elsif new.dispute_status in ('upheld', 'rejected') then
      -- No actor: moderators stay anonymous to the parties.
      perform private.notify(v_member, 'payment_dispute_resolved', null, v_project, v_application, v_membership);
      perform private.notify(v_owner, 'payment_dispute_resolved', null, v_project, v_application, v_membership);
    end if;
  end if;
  return null;
end;
$$;

create trigger payment_reports_activity
  after insert or update on public.payment_reports
  for each row execute function private.activity_from_payment_report();

-- Daily (pg_cron, 20261107091000): tell the professional a payment is due,
-- once per milestone (or per deal). Looks back a week so a missed run
-- catches up; skips anything already reported.
create function private.emit_payment_due(p_today date default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := coalesce(p_today, private.uk_today());
  v_membership uuid;
  v_sent integer := 0;
begin
  for v_membership in
    with due as (
      select d.id as deal_id, x.idx
      from public.deal_sheets d
      cross join lateral (
        select (e.ordinality - 1)::integer as idx, (e.value ->> 'due_date')::date as due_on
        from jsonb_array_elements(d.milestones) with ordinality e
        union all
        select -1, (d.agreed_at at time zone 'Europe/London')::date + d.payment_terms_days
        where jsonb_array_length(d.milestones) = 0
      ) x
      where d.agreed_at is not null
        and d.pay_basis <> 'equity'
        and x.due_on between v_today - 6 and v_today
        and not exists (
          select 1 from public.payment_reports r
          where r.deal_sheet_id = d.id and coalesce(r.milestone_index, -1) = x.idx
        )
    ),
    marked as (
      insert into private.payment_due_notices (deal_sheet_id, milestone_index, sent_on)
      select deal_id, idx, v_today from due
      on conflict do nothing
      returning deal_sheet_id
    )
    select distinct d.membership_id from marked k join public.deal_sheets d on d.id = k.deal_sheet_id
  loop
    perform private.notify(m.user_id, 'payment_due', null, m.project_id, m.application_id, m.id)
    from public.project_memberships m where m.id = v_membership;
    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end;
$$;

revoke execute on function private.activity_from_deal() from public, anon, authenticated;
revoke execute on function private.activity_from_payment_report() from public, anon, authenticated;
revoke execute on function private.emit_payment_due(date) from public, anon, authenticated;
grant execute on function private.emit_payment_due(date) to service_role;

-- ---------------------------------------------------------------------------
-- 8. Edge Function entry points (service_role only)
-- ---------------------------------------------------------------------------
revoke execute on function private.propose_deal(uuid, uuid, boolean, jsonb) from public, anon, authenticated;
revoke execute on function private.confirm_deal(uuid, uuid, integer, boolean) from public, anon, authenticated;
revoke execute on function private.report_payment(uuid, uuid, integer, text, date) from public, anon, authenticated;
revoke execute on function private.dispute_payment(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function private.resolve_payment_dispute(uuid, uuid, boolean, text) from public, anon, authenticated;
grant execute on function private.propose_deal(uuid, uuid, boolean, jsonb) to service_role;
grant execute on function private.confirm_deal(uuid, uuid, integer, boolean) to service_role;
grant execute on function private.report_payment(uuid, uuid, integer, text, date) to service_role;
grant execute on function private.dispute_payment(uuid, uuid, text) to service_role;
grant execute on function private.resolve_payment_dispute(uuid, uuid, boolean, text) to service_role;

create function public.svc_propose_deal(p_actor uuid, p_membership uuid, p_business boolean, p_sheet jsonb)
returns uuid language sql security invoker set search_path = ''
as $$ select private.propose_deal(p_actor, p_membership, p_business, p_sheet); $$;

create function public.svc_confirm_deal(p_actor uuid, p_deal uuid, p_version integer, p_business boolean)
returns void language sql security invoker set search_path = ''
as $$ select private.confirm_deal(p_actor, p_deal, p_version, p_business); $$;

create function public.svc_report_payment(
  p_actor uuid, p_deal uuid, p_milestone integer, p_outcome text, p_paid_on date
)
returns uuid language sql security invoker set search_path = ''
as $$ select private.report_payment(p_actor, p_deal, p_milestone, p_outcome, p_paid_on); $$;

create function public.svc_dispute_payment(p_actor uuid, p_report uuid, p_reason text)
returns void language sql security invoker set search_path = ''
as $$ select private.dispute_payment(p_actor, p_report, p_reason); $$;

create function public.svc_resolve_payment_dispute(p_actor uuid, p_report uuid, p_uphold boolean, p_note text)
returns void language sql security invoker set search_path = ''
as $$ select private.resolve_payment_dispute(p_actor, p_report, p_uphold, p_note); $$;

revoke execute on function public.svc_propose_deal(uuid, uuid, boolean, jsonb) from public, anon, authenticated;
revoke execute on function public.svc_confirm_deal(uuid, uuid, integer, boolean) from public, anon, authenticated;
revoke execute on function public.svc_report_payment(uuid, uuid, integer, text, date) from public, anon, authenticated;
revoke execute on function public.svc_dispute_payment(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.svc_resolve_payment_dispute(uuid, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.svc_propose_deal(uuid, uuid, boolean, jsonb) to service_role;
grant execute on function public.svc_confirm_deal(uuid, uuid, integer, boolean) to service_role;
grant execute on function public.svc_report_payment(uuid, uuid, integer, text, date) to service_role;
grant execute on function public.svc_dispute_payment(uuid, uuid, text) to service_role;
grant execute on function public.svc_resolve_payment_dispute(uuid, uuid, boolean, text) to service_role;
