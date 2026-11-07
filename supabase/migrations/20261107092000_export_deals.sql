-- export_my_data() v2: adds the caller's Deal Sheets, the payment reports
-- on them and the disputes they raised (docs/specs/deal-sheet.md). Same
-- security invoker function and caller-only filters as 20261105120000; the
-- rest of the body is unchanged.

create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'schema_version', 2,
    'exported_at', now(),
    'user_id', v_uid,
    'profile', (select to_jsonb(p) from public.profiles p where p.id = v_uid),
    'skills', coalesce((
      select jsonb_agg(s.name order by s.name)
      from public.profile_skills ps join public.skills s on s.id = ps.skill_id
      where ps.profile_id = v_uid
    ), '[]'::jsonb),
    'portfolio_images', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.position) from public.portfolio_images i where i.profile_id = v_uid
    ), '[]'::jsonb),
    'listings', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id, 'title', p.title, 'public_summary', p.public_summary,
          'opportunity_type', p.opportunity_type, 'status', p.status, 'location', p.location,
          'remote_pref', p.remote_pref, 'commitment', p.commitment, 'duration', p.duration,
          'compensation_type', p.compensation_type, 'compensation_min', p.compensation_min,
          'compensation_max', p.compensation_max, 'currency', p.currency,
          'is_featured', p.is_featured, 'published_at', p.published_at,
          'created_at', p.created_at, 'updated_at', p.updated_at,
          'review_note', public.get_review_note(p.id),
          'admission', (select to_jsonb(a) - 'project_id' from public.project_admission a where a.project_id = p.id),
          'required_skills', coalesce((
            select jsonb_agg(s.name order by s.name)
            from public.project_required_skills rs join public.skills s on s.id = rs.skill_id
            where rs.project_id = p.id
          ), '[]'::jsonb),
          'image_paths', coalesce((
            select jsonb_agg(li.storage_path order by li.position)
            from public.listing_images li where li.project_id = p.id
          ), '[]'::jsonb)
        )
        order by p.created_at
      )
      from public.projects p where p.owner_id = v_uid
    ), '[]'::jsonb),
    'applications', coalesce((
      select jsonb_agg(
        to_jsonb(a) || jsonb_build_object(
          'attachment_paths', coalesce((
            select jsonb_agg(aa.storage_path order by aa.created_at)
            from public.application_attachments aa where aa.application_id = a.id
          ), '[]'::jsonb),
          'questions', coalesce((
            select jsonb_agg(
              jsonb_build_object('question', q.question, 'answer', q.answer,
                                 'asked_at', q.asked_at, 'answered_at', q.answered_at)
              order by q.asked_at
            )
            from public.application_questions q where q.application_id = a.id
          ), '[]'::jsonb)
        )
        order by a.created_at
      )
      from public.applications a where a.applicant_id = v_uid
    ), '[]'::jsonb),
    'collaborations', coalesce((
      select jsonb_agg(
        to_jsonb(m) || jsonb_build_object(
          'outcome', (select to_jsonb(o) - 'membership_id' from public.project_outcomes o where o.membership_id = m.id)
        )
        order by m.joined_at
      )
      from public.project_memberships m
      where m.user_id = v_uid
         or m.project_id in (select id from public.projects where owner_id = v_uid)
    ), '[]'::jsonb),
    'references_written', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.created_at) from public.work_references r where r.author_id = v_uid
    ), '[]'::jsonb),
    'references_received', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.created_at) from public.work_references r where r.subject_id = v_uid
    ), '[]'::jsonb),
    'reports_filed', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', r.id, 'target_kind', r.target_kind, 'profile_id', r.profile_id,
                           'project_id', r.project_id, 'reason', r.reason, 'details', r.details,
                           'status', r.status, 'created_at', r.created_at)
        order by r.created_at
      )
      from public.reports r where r.reporter_id = v_uid
    ), '[]'::jsonb),
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object('blocked_id', b.blocked_id, 'created_at', b.created_at) order by b.created_at)
      from public.blocks b where b.blocker_id = v_uid
    ), '[]'::jsonb),
    'activity', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at) from public.activity x where x.user_id = v_uid
    ), '[]'::jsonb),
    'subscription', (
      select jsonb_build_object('plan', s.plan, 'status', s.status,
                                'current_period_end', s.current_period_end, 'updated_at', s.updated_at)
      from public.subscriptions s where s.user_id = v_uid
    ),
    'legal_acceptances', coalesce((
      select jsonb_agg(jsonb_build_object('document', l.document, 'version', l.version, 'accepted_at', l.accepted_at)
                       order by l.accepted_at)
      from public.legal_acceptances l where l.user_id = v_uid
    ), '[]'::jsonb),
    -- Deal Sheets for collaborations the caller is a party to, the payment
    -- reports on them, and disputes the caller raised. The reviewer's
    -- resolution note (private.payment_dispute_resolutions) is not included.
    'deal_sheets', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.created_at)
      from public.deal_sheets d
      where private.is_membership_party(d.membership_id, v_uid)
    ), '[]'::jsonb),
    'payment_reports', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.created_at)
      from public.payment_reports r
      join public.deal_sheets d on d.id = r.deal_sheet_id
      where private.is_membership_party(d.membership_id, v_uid)
    ), '[]'::jsonb),
    'payment_disputes_raised', coalesce((
      select jsonb_agg(
        jsonb_build_object('report_id', r.id, 'deal_sheet_id', r.deal_sheet_id,
                           'reason', r.dispute_reason, 'status', r.dispute_status,
                           'disputed_at', r.disputed_at, 'resolved_at', r.resolved_at)
        order by r.disputed_at
      )
      from public.payment_reports r
      join public.deal_sheets d on d.id = r.deal_sheet_id
      join public.project_memberships m on m.id = d.membership_id
      join public.projects p on p.id = m.project_id
      where p.owner_id = v_uid and r.dispute_status <> 'none'
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
