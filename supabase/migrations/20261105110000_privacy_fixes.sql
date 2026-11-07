-- Fixes from the 2026-11-05 adversarial pass (docs/ACCESS_CONTROL.md).

-- ---------------------------------------------------------------------------
-- 1. The reviewer's note is between the reviewer and the owner. projects had
-- a table-wide SELECT grant, so anyone who'd applied to a listing that was
-- sent back for changes (e.g. after a report) could read why. Grant every
-- column except review_note; the owner reads it through get_review_note().
-- A new column on projects now needs adding here to be readable.
-- ---------------------------------------------------------------------------
revoke select on public.projects from authenticated;
grant select (
  id, owner_id, title, public_summary, opportunity_type, status, location, remote_pref,
  commitment, duration, compensation_type, compensation_min, compensation_max, currency,
  is_featured, published_at, created_at, updated_at
) on public.projects to authenticated;

create function public.get_review_note(p_project uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select review_note from public.projects
  where id = p_project
    and (owner_id = (select auth.uid()) or private.is_admin((select auth.uid())));
$$;

revoke execute on function public.get_review_note(uuid) from public, anon;
grant execute on function public.get_review_note(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- 2. Reports: survive account deletion (anonymised), and moderators stay
-- anonymous to reporters.
--   * reporter and targets are set null when the account/listing goes, so
--     the moderation history (reason, kind, dates) outlives the people in it
--     and deleting an account never fails on reports from either side;
--   * target_kind remembers what was reported once the target is gone;
--   * column-level SELECT without resolved_by/resolved_at: a reporter could
--     read which moderator closed their report (then their name from
--     profiles). The admin queue reads only granted columns.
-- ---------------------------------------------------------------------------
alter table public.reports
  drop constraint reports_reporter_id_fkey,
  drop constraint reports_profile_id_fkey,
  drop constraint reports_project_id_fkey,
  drop constraint reports_one_target,
  alter column reporter_id drop not null,
  add column target_kind text;

update public.reports
  set target_kind = case when profile_id is not null then 'profile' else 'project' end;

alter table public.reports
  alter column target_kind set not null,
  add constraint reports_target_kind_check check (target_kind in ('profile', 'project')),
  add constraint reports_target_matches_kind check (
    (profile_id is null or target_kind = 'profile') and (project_id is null or target_kind = 'project')
  ),
  -- At most one: both are null once the reported account/listing is deleted.
  -- prepare_report() requires exactly one on insert.
  add constraint reports_at_most_one_target check (num_nonnulls(profile_id, project_id) <= 1),
  add constraint reports_reporter_id_fkey
    foreign key (reporter_id) references public.profiles (id) on delete set null,
  add constraint reports_profile_id_fkey
    foreign key (profile_id) references public.profiles (id) on delete set null,
  add constraint reports_project_id_fkey
    foreign key (project_id) references public.projects (id) on delete set null;

revoke select on public.reports from authenticated;
grant select (id, reporter_id, profile_id, project_id, target_kind, reason, details, status, created_at)
  on public.reports to authenticated;

-- You can only report a listing you can see. Before, anyone holding a
-- draft's id could file a report against it (and learn that it exists).
-- Missing and invisible listings get the same answer.
create or replace function private.prepare_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if num_nonnulls(new.profile_id, new.project_id) <> 1 then
    raise exception 'Choose one profile or one listing to report' using errcode = '22023';
  end if;
  if new.profile_id = new.reporter_id
    or new.project_id in (select id from public.projects where owner_id = new.reporter_id) then
    raise exception 'You can''t report yourself' using errcode = 'P0001';
  end if;
  if new.project_id is not null and not exists (
    select 1 from public.projects p
    where p.id = new.project_id
      and (p.status = 'published' or private.has_applied(p.id, new.reporter_id))
  ) then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;
  if (
    select count(*) from public.reports
    where reporter_id = new.reporter_id and created_at > now() - interval '24 hours'
  ) >= 10 then
    raise exception 'Too many reports today - try again tomorrow' using errcode = 'P0001';
  end if;
  new.target_kind := case when new.profile_id is not null then 'profile' else 'project' end;
  new.details := nullif(btrim(new.details), '');
  new.status := 'open';
  new.resolved_by := null;
  new.resolved_at := null;
  return new;
end;
$$;

-- Closes the report by id, plus every other open report on the same target
-- while that target still exists. (The old version matched on
-- coalesce(profile_id, project_id), which closed nothing - not even the
-- report itself - once the target had been deleted.)
create or replace function private.resolve_report(p_actor uuid, p_report uuid, p_action boolean, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.reports%rowtype;
begin
  if not private.is_admin(p_actor) then
    raise exception 'Only reviewers can do this' using errcode = '42501';
  end if;
  select * into v_report from public.reports where id = p_report for update;
  if not found or v_report.status <> 'open' then
    raise exception 'This report has already been handled' using errcode = 'P0001';
  end if;
  if p_action and v_report.project_id is not null then
    if coalesce(btrim(p_note), '') = '' then
      raise exception 'Tell the owner what to change' using errcode = 'P0001';
    end if;
    update public.projects
      set status = 'changes_requested', review_note = left(p_note, 1000), is_featured = false
      where id = v_report.project_id and status in ('in_review', 'published', 'paused');
  end if;
  update public.reports
    set status = case when p_action then 'actioned' else 'dismissed' end,
        resolved_by = p_actor,
        resolved_at = now()
    where status = 'open'
      and (
        id = p_report
        or (v_report.profile_id is not null and profile_id = v_report.profile_id)
        or (v_report.project_id is not null and project_id = v_report.project_id)
      );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. The "no contact details before mutual acceptance" rule, rebuilt.
--
-- (a) Enforced by BEFORE INSERT/UPDATE triggers that only test a column
--     when it is new or changed, instead of CHECK constraints. Postgres
--     re-checks every CHECK on every UPDATE, so tightening the patterns made
--     rows written under the old rule un-updatable (status changes, the
--     billing webhook's is_featured refresh, moderation take-downs, closing a
--     listing). Violations raise SQLSTATE 23514 with the user-facing message,
--     HINT 'CONTACT_DETAILS' and DETAIL 'no_contact: <table>.<column>' (the Edge Function
--     error mapper keys on the hint: other CHECK failures are 23514 too).
--
-- (b) Text is normalised before matching (private.contact_text):
--     invisible/format characters removed, NFKC (full-width, maths
--     digits, compatibility spaces), non-ASCII decimal digits folded to
--     ASCII, common Cyrillic/Greek look-alike letters folded to Latin and
--     the ideographic full stop folded to ".".
--
-- (c) Phone numbers need a +, 00 or 0 prefix, so year ranges
--     ("2015-2019 2020-2024"), dates and "10 000 - 50 000" pass. "(at)" and
--     "dot com" only count next to a domain-like word, so "Amazon (AT) scale"
--     and "the dot com boom" pass.
--
-- Still a speed bump, not a wall (spelled-out numbers and @handles get
-- through by design); reports and curation are the backstop.
--
-- ===== Patterns for lib/validation.ts (keep in sync, same test cases) =====
-- Applied case-insensitively (~*) to contact_text(input). Postgres \m and
-- \M (word start/end) are \b in JS; [[:space:]] is \s.
--
-- Strip (JS: .replace(/[...]/gu, "")):
--   [­͏؀-؅؜۝܏࢐࢑࣢ᅟᅠ
--    ឴឵᠋-᠏​-‏‪-‮⁠-⁤
--    ⁦-⁯ㅤ︀-️﻿ﾠ￹-￻
--    \U000E0001\U000E0020-\U000E007F]          (JS: \u{E0001}, \u{E0020}-\u{E007F})
-- then .normalize("NFKC"), then fold each character of FROM to the same
-- position in TO (digit blocks: U+0660 U+06F0 U+07C0 U+0966 U+09E6 U+0A66
-- U+0AE6 U+0B66 U+0BE6 U+0C66 U+0CE6 U+0D66 U+0DE6 U+0E50 U+0ED0 U+0F20
-- U+1040 U+1090 U+17E0 U+1810 U+1946 U+19D0 U+1A80 U+1A90 U+1B50 U+1BB0
-- U+1C40 U+1C50 U+A620 U+A8D0 U+A900 U+A9D0 U+A9F0 U+AA50 U+ABF0, each
-- base+0..9 -> "0".."9"; then look-alikes: Cyrillic
-- аеорсухіјѕԁӏАВЕКМНОРСТХІЈЅ -> aeopcyxijsdlABEKMHOPCTXIJS,
-- Greek οαικνρΟΑΒΕΚΜΝΤΧΖΗΙΡ -> oaikvpOABEKMNTXZHIP, U+3002 -> ".").
--
-- 1 email     [a-z0-9._%+-]+[[:space:]]*@[[:space:]]*[a-z0-9-]+\.[a-z]{2,}
-- 2 webmail   [a-z0-9._%+-]+@(gmail|googlemail|hotmail|outlook|live|yahoo|icloud|proton|protonmail)\M
-- 3 link      (https?://|www\.)
-- 4 known     \m(linkedin\.com|lnkd\.in|instagram\.com|facebook\.com|fb\.com|fb\.me|twitter\.com|x\.com|tiktok\.com|calendly\.com|wa\.me|t\.me|telegram\.me|discord\.gg|discord\.com|skype\.com|snapchat\.com|linktr\.ee|youtube\.com|youtu\.be|bit\.ly|tinyurl\.com|github\.com|gitlab\.com|behance\.net|dribbble\.com)\M
-- 5 (at)      [a-z0-9._%+-][[:space:]]*[(\[{<][[:space:]]*at[[:space:]]*[)\]}>][[:space:]]*[a-z0-9-]+[[:space:]]*(\.|[(\[{<][[:space:]]*dot[[:space:]]*[)\]}>]|\mdot\M)
-- 6 (dot)     [(\[{<][[:space:]]*dot[[:space:]]*[)\]}>][[:space:]]*(com|co|net|org|io|uk|me|dev)\M
-- 7 at/dot    \mat[[:space:]]+[a-z0-9-]+[[:space:]]+dot[[:space:]]+(com|co|net|org|io|uk|me|dev)\M
-- 8 phone     (\+[[:space:]]?|\m00?)[1-9]([[:space:]()./,_|·‐-―•−-]{0,2}[0-9]){8,}
-- ==========================================================================
-- ---------------------------------------------------------------------------
create or replace function private.contact_text(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select translate(
    normalize(
      regexp_replace(
        p_text,
        '[­͏؀-؅؜۝܏࢐࢑࣢ᅟᅠ឴឵᠋-᠏​-‏‪-‮⁠-⁤⁦-⁯ㅤ︀-️﻿ﾠ￹-￻\U000E0001\U000E0020-\U000E007F]',
        '',
        'g'
      ),
      NFKC
    ),
      U&'\0660\0661\0662\0663\0664\0665\0666\0667\0668\0669\06F0\06F1\06F2\06F3\06F4\06F5\06F6\06F7\06F8\06F9\07C0\07C1\07C2\07C3\07C4\07C5\07C6\07C7\07C8\07C9\0966\0967\0968\0969\096A\096B\096C\096D\096E\096F\09E6\09E7\09E8\09E9\09EA\09EB\09EC\09ED\09EE\09EF'
      || U&'\0A66\0A67\0A68\0A69\0A6A\0A6B\0A6C\0A6D\0A6E\0A6F\0AE6\0AE7\0AE8\0AE9\0AEA\0AEB\0AEC\0AED\0AEE\0AEF\0B66\0B67\0B68\0B69\0B6A\0B6B\0B6C\0B6D\0B6E\0B6F\0BE6\0BE7\0BE8\0BE9\0BEA\0BEB\0BEC\0BED\0BEE\0BEF\0C66\0C67\0C68\0C69\0C6A\0C6B\0C6C\0C6D\0C6E\0C6F'
      || U&'\0CE6\0CE7\0CE8\0CE9\0CEA\0CEB\0CEC\0CED\0CEE\0CEF\0D66\0D67\0D68\0D69\0D6A\0D6B\0D6C\0D6D\0D6E\0D6F\0DE6\0DE7\0DE8\0DE9\0DEA\0DEB\0DEC\0DED\0DEE\0DEF\0E50\0E51\0E52\0E53\0E54\0E55\0E56\0E57\0E58\0E59\0ED0\0ED1\0ED2\0ED3\0ED4\0ED5\0ED6\0ED7\0ED8\0ED9'
      || U&'\0F20\0F21\0F22\0F23\0F24\0F25\0F26\0F27\0F28\0F29\1040\1041\1042\1043\1044\1045\1046\1047\1048\1049\1090\1091\1092\1093\1094\1095\1096\1097\1098\1099\17E0\17E1\17E2\17E3\17E4\17E5\17E6\17E7\17E8\17E9\1810\1811\1812\1813\1814\1815\1816\1817\1818\1819'
      || U&'\1946\1947\1948\1949\194A\194B\194C\194D\194E\194F\19D0\19D1\19D2\19D3\19D4\19D5\19D6\19D7\19D8\19D9\1A80\1A81\1A82\1A83\1A84\1A85\1A86\1A87\1A88\1A89\1A90\1A91\1A92\1A93\1A94\1A95\1A96\1A97\1A98\1A99\1B50\1B51\1B52\1B53\1B54\1B55\1B56\1B57\1B58\1B59'
      || U&'\1BB0\1BB1\1BB2\1BB3\1BB4\1BB5\1BB6\1BB7\1BB8\1BB9\1C40\1C41\1C42\1C43\1C44\1C45\1C46\1C47\1C48\1C49\1C50\1C51\1C52\1C53\1C54\1C55\1C56\1C57\1C58\1C59\A620\A621\A622\A623\A624\A625\A626\A627\A628\A629\A8D0\A8D1\A8D2\A8D3\A8D4\A8D5\A8D6\A8D7\A8D8\A8D9'
      || U&'\A900\A901\A902\A903\A904\A905\A906\A907\A908\A909\A9D0\A9D1\A9D2\A9D3\A9D4\A9D5\A9D6\A9D7\A9D8\A9D9\A9F0\A9F1\A9F2\A9F3\A9F4\A9F5\A9F6\A9F7\A9F8\A9F9\AA50\AA51\AA52\AA53\AA54\AA55\AA56\AA57\AA58\AA59\ABF0\ABF1\ABF2\ABF3\ABF4\ABF5\ABF6\ABF7\ABF8\ABF9'
      || U&'\0430\0435\043E\0440\0441\0443\0445\0456\0458\0455\0501\04CF\0410\0412\0415\041A'
      || U&'\041C\041D\041E\0420\0421\0422\0425\0406\0408\0405\03BF\03B1\03B9\03BA\03BD\03C1'
      || U&'\039F\0391\0392\0395\039A\039C\039D\03A4\03A7\0396\0397\0399\03A1\3002',
      '01234567890123456789012345678901234567890123456789'
      || '01234567890123456789012345678901234567890123456789'
      || '01234567890123456789012345678901234567890123456789'
      || '01234567890123456789012345678901234567890123456789'
      || '01234567890123456789012345678901234567890123456789'
      || '01234567890123456789012345678901234567890123456789'
      || '01234567890123456789012345678901234567890123456789'
      || 'aeopcyxijsdlABEK'
      || 'MHOPCTXIJSoaikvp'
      || 'OABEKMNTXZHIP.'
  );
$$;

create or replace function private.has_contact_details(p_text text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_text is not null and (
    s ~* '[a-z0-9._%+-]+[[:space:]]*@[[:space:]]*[a-z0-9-]+\.[a-z]{2,}'
    or s ~* '[a-z0-9._%+-]+@(gmail|googlemail|hotmail|outlook|live|yahoo|icloud|proton|protonmail)\M'
    or s ~* '(https?://|www\.)'
    or s ~* '\m(linkedin\.com|lnkd\.in|instagram\.com|facebook\.com|fb\.com|fb\.me|twitter\.com|x\.com|tiktok\.com|calendly\.com|wa\.me|t\.me|telegram\.me|discord\.gg|discord\.com|skype\.com|snapchat\.com|linktr\.ee|youtube\.com|youtu\.be|bit\.ly|tinyurl\.com|github\.com|gitlab\.com|behance\.net|dribbble\.com)\M'
    or s ~* '[a-z0-9._%+-][[:space:]]*[(\[{<][[:space:]]*at[[:space:]]*[)\]}>][[:space:]]*[a-z0-9-]+[[:space:]]*(\.|[(\[{<][[:space:]]*dot[[:space:]]*[)\]}>]|\mdot\M)'
    or s ~* '[(\[{<][[:space:]]*dot[[:space:]]*[)\]}>][[:space:]]*(com|co|net|org|io|uk|me|dev)\M'
    or s ~* '\mat[[:space:]]+[a-z0-9-]+[[:space:]]+dot[[:space:]]+(com|co|net|org|io|uk|me|dev)\M'
    or s ~ '(\+[[:space:]]?|\m00?)[1-9]([[:space:]()./,_|·‐-―•−-]{0,2}[0-9]){8,}'
  )
  from (select private.contact_text(p_text) as s) as normalized;
$$;

revoke execute on function private.contact_text(text) from public;
revoke execute on function private.has_contact_details(text) from public;
grant execute on function private.contact_text(text) to authenticated, service_role;
grant execute on function private.has_contact_details(text) to authenticated, service_role;

-- Trigger arguments are the guarded column names.
create function private.enforce_contact_rule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
  v_col text;
begin
  foreach v_col in array tg_argv loop
    if (tg_op = 'INSERT' or (v_new -> v_col) is distinct from (v_old -> v_col))
      and private.has_contact_details(v_new ->> v_col) then
      raise exception using
        errcode = '23514',
        message = 'Leave out emails, phone numbers and links. Contact details are shared automatically once you both accept.',
        detail = 'no_contact: ' || tg_table_name || '.' || v_col,
        hint = 'CONTACT_DETAILS',
        constraint = tg_table_name || '_' || v_col || '_no_contact',
        table = tg_table_name,
        column = v_col;
    end if;
  end loop;
  return new;
end;
$$;

revoke execute on function private.enforce_contact_rule() from public, anon, authenticated;

alter table public.profiles
  drop constraint profiles_headline_no_contact,
  drop constraint profiles_bio_no_contact,
  drop constraint profiles_details_no_contact;
alter table public.projects
  drop constraint projects_title_no_contact,
  drop constraint projects_summary_no_contact,
  drop constraint projects_details_no_contact;
alter table public.project_admission drop constraint admission_no_contact;
alter table public.applications
  drop constraint applications_cover_note_no_contact,
  drop constraint applications_decision_note_no_contact;
alter table public.portfolio_images drop constraint portfolio_images_caption_no_contact;
alter table public.skills drop constraint skills_name_no_contact;
alter table public.application_questions drop constraint application_questions_no_contact;
alter table public.work_references drop constraint work_references_no_contact;

create trigger profiles_contact_rule
  before insert or update of full_name, headline, bio, location, current_title, availability, experience_level
  on public.profiles
  for each row execute function private.enforce_contact_rule(
    'full_name', 'headline', 'bio', 'location', 'current_title', 'availability', 'experience_level'
  );

create trigger projects_contact_rule
  before insert or update of title, public_summary, location, duration on public.projects
  for each row execute function private.enforce_contact_rule('title', 'public_summary', 'location', 'duration');

create trigger project_admission_contact_rule
  before insert or update of what_exists_already, first_milestone, proposed_terms, owner_contribution
  on public.project_admission
  for each row execute function private.enforce_contact_rule(
    'what_exists_already', 'first_milestone', 'proposed_terms', 'owner_contribution'
  );

create trigger applications_contact_rule
  before insert or update of cover_note, decision_note on public.applications
  for each row execute function private.enforce_contact_rule('cover_note', 'decision_note');

create trigger portfolio_images_contact_rule
  before insert or update of caption on public.portfolio_images
  for each row execute function private.enforce_contact_rule('caption');

create trigger skills_contact_rule
  before insert or update of name on public.skills
  for each row execute function private.enforce_contact_rule('name');

-- Question and answer are tested separately (concatenating them let one
-- half of an address sit in each).
create trigger application_questions_contact_rule
  before insert or update of question, answer on public.application_questions
  for each row execute function private.enforce_contact_rule('question', 'answer');

create trigger work_references_contact_rule
  before insert or update of body on public.work_references
  for each row execute function private.enforce_contact_rule('body');
