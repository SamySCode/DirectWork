-- Images (profile photo, portfolio, listing images, application
-- attachments) and the "no contact details before mutual acceptance"
-- content rule. See docs/DATA_MODEL.md and docs/ACCESS_CONTROL.md.
--
-- Storage layout - the first folder is always the uploader's user id, which
-- is what the storage.objects policies key on:
--   avatars/<user>/<uuid>.jpg                      public bucket
--   portfolio/<user>/<uuid>.jpg                    public bucket
--   listing-images/<owner>/<project>/<uuid>.jpg    public bucket
--   application-attachments/<applicant>/<uuid>.jpg PRIVATE (signed URLs)
--
-- Public buckets serve by unguessable URL without a per-request auth
-- check: cheaper and cacheable (CLAUDE.md cost priority), at the price that
-- anyone holding a URL can view that image. Application attachments are
-- shared only with one listing owner, so they stay private.

-- ---------------------------------------------------------------------------
-- Content rule: contact details only flow through contact reveal (on mutual
-- acceptance). Emails, phone numbers and links are rejected in free text
-- that other people read before that point. Mirrored in
-- lib/validation.ts (noContactDetails) for inline feedback - keep the
-- patterns in sync.
-- ---------------------------------------------------------------------------
create function private.has_contact_details(p_text text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_text is not null and (
    p_text ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'
    or p_text ~* '(https?://|www\.)'
    or p_text ~ '\+?\(?[0-9]([[:space:]().-]*[0-9]){9,}'
  );
$$;

revoke execute on function private.has_contact_details(text) from public;
grant execute on function private.has_contact_details(text) to authenticated, service_role;

-- NOT VALID: enforced on every new insert/update, without failing the
-- migration over any row written before the rule existed.
alter table public.profiles
  add constraint profiles_headline_no_contact check (not private.has_contact_details(headline)) not valid,
  add constraint profiles_bio_no_contact check (not private.has_contact_details(bio)) not valid;

alter table public.projects
  add constraint projects_title_no_contact check (not private.has_contact_details(title)) not valid,
  add constraint projects_summary_no_contact check (not private.has_contact_details(public_summary)) not valid;

alter table public.project_admission
  add constraint admission_no_contact check (
    not private.has_contact_details(
      what_exists_already || ' ' || first_milestone || ' ' || proposed_terms || ' ' || owner_contribution
    )
  ) not valid;

alter table public.applications
  add constraint applications_cover_note_no_contact check (not private.has_contact_details(cover_note)) not valid;

-- ---------------------------------------------------------------------------
-- Buckets. The size/type limits here are enforced by Supabase Storage on
-- upload, whatever the client does. The client also resizes to <=1600px
-- JPEG before uploading, so real files are far below the cap.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('portfolio', 'portfolio', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('listing-images', 'listing-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('application-attachments', 'application-attachments', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Profile photo: avatar_url holds the object path inside the avatars bucket
-- (the client builds the public URL), and must sit in the user's own folder
-- - so it can never point at an arbitrary external URL (tracking pixels,
-- hotlinked content).
-- ---------------------------------------------------------------------------
alter table public.profiles
  add constraint profiles_avatar_path check (
    avatar_url is null
    or avatar_url ~ ('^' || id::text || '/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$')
  ) not valid;

-- ---------------------------------------------------------------------------
-- Portfolio images (max 6 per profile)
-- ---------------------------------------------------------------------------
create table public.portfolio_images (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  caption text,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint portfolio_images_path check (
    storage_path ~ ('^' || profile_id::text || '/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$')
  ),
  constraint portfolio_images_caption_length check (char_length(caption) <= 140),
  constraint portfolio_images_caption_no_contact check (not private.has_contact_details(caption))
);

create index portfolio_images_profile_idx on public.portfolio_images (profile_id, position);

alter table public.portfolio_images enable row level security;

create policy "Portfolio images are readable by authenticated users"
  on public.portfolio_images for select
  to authenticated
  using (true);

create policy "Users can add their own portfolio images"
  on public.portfolio_images for insert
  to authenticated
  with check (profile_id = (select auth.uid()));

create policy "Users can edit their own portfolio images"
  on public.portfolio_images for update
  to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "Users can remove their own portfolio images"
  on public.portfolio_images for delete
  to authenticated
  using (profile_id = (select auth.uid()));

grant select, delete on public.portfolio_images to authenticated;
grant insert (storage_path, caption, position) on public.portfolio_images to authenticated;
grant update (caption, position) on public.portfolio_images to authenticated;

-- ---------------------------------------------------------------------------
-- Listing images (max 4 per listing, editable only while the listing is)
-- ---------------------------------------------------------------------------
create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  storage_path text not null unique,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

create index listing_images_project_idx on public.listing_images (project_id, position);

alter table public.listing_images enable row level security;

create policy "Listing images follow listing visibility"
  on public.listing_images for select
  to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id));

create policy "Owners can add images while editing"
  on public.listing_images for insert
  to authenticated
  with check (private.can_edit_project(project_id, (select auth.uid())));

create policy "Owners can remove images while editing"
  on public.listing_images for delete
  to authenticated
  using (private.can_edit_project(project_id, (select auth.uid())));

grant select, delete on public.listing_images to authenticated;
grant insert (project_id, storage_path, position) on public.listing_images to authenticated;

-- ---------------------------------------------------------------------------
-- Application attachments (max 3, added while the application is pending)
-- ---------------------------------------------------------------------------
create table public.application_attachments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

create index application_attachments_app_idx on public.application_attachments (application_id);

alter table public.application_attachments enable row level security;

create policy "Attachments follow application visibility"
  on public.application_attachments for select
  to authenticated
  using (exists (select 1 from public.applications a where a.id = application_id));

create policy "Applicants can attach to their pending application"
  on public.application_attachments for insert
  to authenticated
  with check (
    exists (
      select 1 from public.applications a
      where a.id = application_id and a.applicant_id = (select auth.uid()) and a.status = 'submitted'
    )
  );

create policy "Applicants can remove attachments from their pending application"
  on public.application_attachments for delete
  to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.id = application_id and a.applicant_id = (select auth.uid()) and a.status = 'submitted'
    )
  );

grant select, delete on public.application_attachments to authenticated;
grant insert (application_id, storage_path) on public.application_attachments to authenticated;

-- ---------------------------------------------------------------------------
-- Path + count rules for the image tables. Paths must sit in the uploader's
-- own folder (so a row can't reference someone else's file), and counts are
-- capped so one account can't store unbounded files.
-- ---------------------------------------------------------------------------
create function private.check_image_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_count integer;
  v_file constant text := '[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$';
begin
  if tg_table_name = 'portfolio_images' then
    select count(*) into v_count from public.portfolio_images where profile_id = new.profile_id;
    if v_count >= 6 then
      raise exception 'You can add up to 6 portfolio images' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'listing_images' then
    select owner_id into v_owner from public.projects where id = new.project_id;
    if new.storage_path !~ ('^' || v_owner::text || '/' || new.project_id::text || '/' || v_file) then
      raise exception 'Invalid image path' using errcode = 'P0001';
    end if;
    select count(*) into v_count from public.listing_images where project_id = new.project_id;
    if v_count >= 4 then
      raise exception 'A listing can have up to 4 images' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'application_attachments' then
    select applicant_id into v_owner from public.applications where id = new.application_id;
    if new.storage_path !~ ('^' || v_owner::text || '/' || v_file) then
      raise exception 'Invalid attachment path' using errcode = 'P0001';
    end if;
    select count(*) into v_count from public.application_attachments where application_id = new.application_id;
    if v_count >= 3 then
      raise exception 'You can attach up to 3 images' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function private.check_image_row() from public;

create trigger portfolio_images_check
  before insert on public.portfolio_images
  for each row execute function private.check_image_row();

create trigger listing_images_check
  before insert on public.listing_images
  for each row execute function private.check_image_row();

create trigger application_attachments_check
  before insert on public.application_attachments
  for each row execute function private.check_image_row();

-- A malformed folder name must deny, not error mid-policy.
create function private.try_uuid(p_text text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_text::uuid;
exception when others then
  return null;
end;
$$;

-- Security definer so the storage policy can look through applications
-- without depending on (and recursing into) their RLS.
create function private.can_view_attachment(p_path text, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.application_attachments aa
    join public.applications a on a.id = aa.application_id
    join public.projects p on p.id = a.project_id
    where aa.storage_path = p_path and p.owner_id = p_user
  );
$$;

revoke execute on function private.try_uuid(text) from public;
revoke execute on function private.can_view_attachment(text, uuid) from public;
grant execute on function private.try_uuid(text) to authenticated, service_role;
grant execute on function private.can_view_attachment(text, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- storage.objects policies. Public buckets need no select policy for
-- viewing by URL; the select policies below cover listing/removing your own
-- files (Storage requires select to delete).
-- ---------------------------------------------------------------------------
create policy "Users manage files in their own avatar/portfolio folder"
  on storage.objects for all
  to authenticated
  using (
    bucket_id in ('avatars', 'portfolio')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id in ('avatars', 'portfolio')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Owners read and remove their listing image files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Owners upload listing images while editing"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.can_edit_project(
      private.try_uuid((storage.foldername(name))[2]),
      (select auth.uid())
    )
  );

create policy "Owners delete their listing image files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Applicants upload attachments to their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'application-attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Applicants delete their own attachment files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'application-attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Private bucket reads (signed URLs are minted under this policy): the
-- applicant, or the owner of the listing the attachment was sent to.
create policy "Applicants and listing owners read attachments"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'application-attachments'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or private.can_view_attachment(name, (select auth.uid()))
    )
  );
