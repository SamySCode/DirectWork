// Runs the real migrations against PGlite (Postgres compiled to WASM) with a
// minimal stand-in for the parts of Supabase they depend on: the auth schema,
// auth.uid(), and the anon/authenticated/service_role roles. No Docker or
// live project needed, so RLS and transition rules get tested on every run.
//
// What this does NOT cover: PostgREST's own behaviour (e.g. which schemas are
// exposed) and Edge Function auth - supabase/tests/rls-profiles.mjs still
// exists for checking a real deployed project end to end.

import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(import.meta.dirname, "..", "..", "migrations");

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  create table auth.users (id uuid primary key, email text);
  -- Mirrors Supabase's auth.uid(): a custom GUC reads back as '' (not null)
  -- once it has been set in any earlier transaction, so guard both levels.
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub', '')::uuid
  $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  -- Just enough of Supabase Storage for the bucket inserts and
  -- storage.objects policies to apply and be exercised.
  create schema storage;
  grant usage on schema storage to anon, authenticated, service_role;
  create table storage.buckets (
    id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text not null
  );
  alter table storage.objects enable row level security;
  grant select, insert, update, delete on storage.objects to authenticated;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  grant execute on function storage.foldername(text) to anon, authenticated, service_role;
`;

export async function createDb() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const file of files) {
    try {
      await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${error.message}`, { cause: error });
    }
  }
  // No blanket grants: new Supabase projects don't auto-grant tables to the
  // Data API roles, so the migrations must grant everything they rely on -
  // including what service_role (the Edge Functions) reads directly.
  return db;
}

async function inRole(db, role, userId, fn) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify(userId ? { sub: userId, role } : { role }),
    ]);
    await tx.exec(`set local role ${role}`);
    return fn(tx);
  });
}

/** Runs a query as an authenticated user, the way PostgREST would. */
export function asUser(db, userId, sql, params = []) {
  return inRole(db, "authenticated", userId, (tx) => tx.query(sql, params));
}

/** Runs a query as the service role (what Edge Functions use). */
export function asService(db, sql, params = []) {
  return inRole(db, "service_role", null, (tx) => tx.query(sql, params));
}

export async function createUser(db, { profile = true, ...fields } = {}) {
  const id = randomUUID();
  await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, `${id}@example.com`]);
  if (profile) {
    await db.query(
      `insert into public.profiles (id, full_name, headline, seeking_paid, wants_to_hire)
       values ($1, $2, 'Tester', true, true)`,
      [id, fields.name ?? "Test User"],
    );
  }
  return id;
}

export async function makeAdmin(db, userId) {
  await db.query(`insert into public.admins (user_id) values ($1)`, [userId]);
}

/** Creates a draft listing owned by ownerId with one required skill. */
export async function createDraft(db, ownerId, { type = "paid" } = {}) {
  const {
    rows: [project],
  } = await asUser(
    db,
    ownerId,
    `insert into public.projects (title, public_summary, opportunity_type, compensation_type)
     values ('Build a booking app', 'We need a mobile booking flow built in React Native.', $1, $2)
     returning id`,
    [type, type === "paid" ? "fixed" : null],
  );
  const {
    rows: [skill],
  } = await db.query(
    `insert into public.skills (name) values ($1)
     on conflict (lower(name)) do update set name = excluded.name
     returning id`,
    ["React Native"],
  );
  await asUser(
    db,
    ownerId,
    `insert into public.project_required_skills (project_id, skill_id) values ($1, $2)`,
    [project.id, skill.id],
  );
  if (type === "partner") {
    await asUser(
      db,
      ownerId,
      `insert into public.project_admission
         (project_id, what_exists_already, weekly_commitment_hours, first_milestone, proposed_terms, owner_contribution)
       values ($1, 'Working prototype with 40 beta users', 10, 'Ship payments by March', '10% equity, 4yr vest', 'Full-time founder, funding the infra')`,
      [project.id],
    );
  }
  return project.id;
}

export async function publish(db, ownerId, adminId, projectId) {
  await asService(db, `select public.svc_submit_listing($1, $2)`, [ownerId, projectId]);
  await asService(db, `select public.svc_review_listing($1, $2, true, null)`, [adminId, projectId]);
}
