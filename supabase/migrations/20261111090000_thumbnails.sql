-- Thumbnails and query fixes. See docs/ACCESS_CONTROL.md.
--
-- 1. Thumbnails. The client uploads a small JPEG next to every avatar,
--    portfolio and listing image (lib/images.ts), and lists, cards and avatars
--    load that instead of the full file. Storage layout:
--      avatars/<user>/<uuid>.jpg            + <user>/<uuid>.thumb.jpg
--      portfolio/<user>/<uuid>.jpg          + <user>/<uuid>.thumb.jpg
--      listing-images/<owner>/<project>/<uuid>.jpg + .../<uuid>.thumb.jpg
--    A thumbnail has no row and no column of its own: its path is derived
--    from the image's, so the path constraints and triggers on the image
--    rows, the folder-keyed storage.objects policies, the export and the
--    account-deletion cascade all hold unchanged. What this migration adds:
--      - thumbnails don't count against the per-user file caps, and get a
--        cap of their own (the same number) plus "its full image must already
--        exist", so the allowance is neither halved nor a second locker;
--      - none in the private attachments bucket (never shown small);
--      - whenever an image is queued for cleanup, so is its thumbnail.
--    Images uploaded before this have no thumbnail: the client falls back to
--    the full file, and queueing a thumbnail that isn't there is harmless
--    (Storage's remove ignores missing objects).
-- 2. Indexes for the two list queries that didn't scale (measured on the
--    PGlite harness with 6,000 listings): Discover sorted by pay, and the
--    review queue.

-- ---------------------------------------------------------------------------
-- 1a. Path helpers.
-- ---------------------------------------------------------------------------
create function private.is_thumbnail_path(p_path text)
returns boolean
language sql
immutable
set search_path = ''
as $$ select p_path like '%.thumb.jpg'; $$;

-- '<folder>/<uuid>.jpg' -> '<folder>/<uuid>.thumb.jpg'. Null for anything that
-- isn't an image path (or already is a thumbnail).
create function private.thumbnail_path(p_path text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_path ~ '\.(jpg|jpeg|png|webp)$' and p_path not like '%.thumb.jpg'
      then regexp_replace(p_path, '\.(jpg|jpeg|png|webp)$', '.thumb.jpg')
  end;
$$;

-- The image paths a file could belong to: itself, or - for a thumbnail - its
-- full image under each allowed extension. Lets callers match on the indexed
-- storage_path columns instead of computing a thumbnail path per row.
create function private.image_path_candidates(p_path text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case
    when p_path like '%.thumb.jpg' then array[
      left(p_path, -10) || '.jpg', left(p_path, -10) || '.jpeg',
      left(p_path, -10) || '.png', left(p_path, -10) || '.webp'
    ]
    else array[p_path]
  end;
$$;

revoke execute on function private.is_thumbnail_path(text) from public, anon;
revoke execute on function private.thumbnail_path(text) from public, anon;
revoke execute on function private.image_path_candidates(text) from public, anon;
grant execute on function private.is_thumbnail_path(text) to authenticated, service_role;
grant execute on function private.thumbnail_path(text) to authenticated, service_role;
grant execute on function private.image_path_candidates(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1b. Per-user caps. Full images keep exactly the allowance they had;
-- thumbnails are counted separately.
-- ---------------------------------------------------------------------------
create or replace function private.storage_object_count(p_bucket text, p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from storage.objects
  where bucket_id = p_bucket
    and name like p_user::text || '/%'
    and name not like '%.thumb.jpg';
$$;

-- A thumbnail upload is allowed when it sits in the caller's folder of a
-- public image bucket, is named after a full image that is already there,
-- and the caller has fewer thumbnails than the bucket's image cap.
create function private.can_upload_thumbnail(p_bucket text, p_name text, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_bucket in ('avatars', 'portfolio', 'listing-images')
    and p_name ~ ('^' || p_user::text || '/([0-9a-f-]{36}/)?[0-9a-f-]{36}\.thumb\.jpg$')
    and exists (
      select 1 from storage.objects o
      where o.bucket_id = p_bucket
        and o.name = any (private.image_path_candidates(p_name))
    )
    and (
      select count(*) from storage.objects o
      where o.bucket_id = p_bucket
        and o.name like p_user::text || '/%'
        and o.name like '%.thumb.jpg'
    ) < case p_bucket
      when 'avatars' then 3
      when 'portfolio' then 8
      when 'listing-images' then 40
      else 0
    end;
$$;

revoke execute on function private.can_upload_thumbnail(text, text, uuid) from public, anon;
grant execute on function private.can_upload_thumbnail(text, text, uuid) to authenticated, service_role;

drop policy "Per-user file caps" on storage.objects;
create policy "Per-user file caps"
  on storage.objects as restrictive for insert
  to authenticated
  with check (
    case
      when private.is_thumbnail_path(name)
        then private.can_upload_thumbnail(bucket_id, name, (select auth.uid()))
      else private.storage_object_count(bucket_id, (select auth.uid())) < case bucket_id
        when 'avatars' then 3
        when 'portfolio' then 8
        when 'listing-images' then 40
        when 'application-attachments' then 15
        else 0
      end
    end
  );

-- ---------------------------------------------------------------------------
-- 1c. Cleanup queue: an image and its thumbnail are queued together (row
-- deletes, cascades from account deletion and retention, avatar changes).
-- ---------------------------------------------------------------------------
create or replace function private.enqueue_storage_cleanup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bucket text;
  v_path text;
begin
  if tg_table_name = 'profiles' then
    v_bucket := 'avatars';
    v_path := old.avatar_url;
    if tg_op = 'UPDATE' and new.avatar_url is not distinct from old.avatar_url then
      return null;
    end if;
  else
    v_bucket := case tg_table_name
      when 'application_attachments' then 'application-attachments'
      when 'listing_images' then 'listing-images'
      when 'portfolio_images' then 'portfolio'
    end;
    v_path := old.storage_path;
  end if;
  if v_bucket is not null and v_path is not null then
    insert into private.storage_cleanup (bucket, path) values (v_bucket, v_path)
      on conflict (bucket, path) do nothing;
    if v_bucket <> 'application-attachments' and private.thumbnail_path(v_path) is not null then
      insert into private.storage_cleanup (bucket, path)
        values (v_bucket, private.thumbnail_path(v_path))
        on conflict (bucket, path) do nothing;
    end if;
  end if;
  return null;
end;
$$;

-- Same as before, except "referenced again" also rescues the thumbnail of an
-- image that is referenced again.
create or replace function private.claim_storage_cleanup(p_limit integer)
returns table (id bigint, bucket text, path text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  delete from private.storage_cleanup q
  where (q.bucket = 'avatars' and exists (
          select 1 from public.profiles p
          where p.avatar_url = any (private.image_path_candidates(q.path))))
    or (q.bucket = 'portfolio' and exists (
          select 1 from public.portfolio_images i
          where i.storage_path = any (private.image_path_candidates(q.path))))
    or (q.bucket = 'listing-images' and exists (
          select 1 from public.listing_images i
          where i.storage_path = any (private.image_path_candidates(q.path))))
    or (q.bucket = 'application-attachments'
        and exists (select 1 from public.application_attachments i where i.storage_path = q.path));
  return query
    with picked as (
      select q.id from private.storage_cleanup q
      where (q.claimed_at is null or q.claimed_at < now() - interval '15 minutes')
        -- Grace period: a path queued moments ago may be mid re-upload.
        and q.queued_at < now() - interval '10 minutes'
        -- Legal hold (OSA/CSEA preservation): keep a held user's files.
        and not exists (
          select 1 from private.legal_holds h where h.user_id::text = split_part(q.path, '/', 1)
        )
      order by q.id
      limit least(greatest(coalesce(p_limit, 100), 1), 1000)
      for update skip locked
    )
    update private.storage_cleanup q
      set claimed_at = now()
      from picked
      where q.id = picked.id
      returning q.id, q.bucket, q.path;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Query fixes.
-- ---------------------------------------------------------------------------
-- Discover sorted by pay: without this the planner read every published
-- listing (and built each one's owner, skills and cover) before sorting to
-- take 20. Column order and null placement match the request's ORDER BY.
create index projects_discover_pay_idx
  on public.projects (compensation_max desc nulls last, compensation_min desc nulls last, published_at desc)
  where status = 'published';

-- Review queue, oldest first.
create index projects_review_queue_idx
  on public.projects (updated_at)
  where status = 'in_review';
