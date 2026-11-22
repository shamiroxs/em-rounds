-- 00009: RLS and API privileges.
-- Helper functions are SECURITY DEFINER and return only role/entitlement booleans.
create or replace function public.has_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.code = required_role
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin') or public.has_role('owner_admin');
$$;

create or replace function public.has_platform_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.entitlements e
    where e.user_id = auth.uid()
      and e.scope_type = 'platform'
      and e.status = 'active'
      and e.starts_at <= now()
      and e.expires_at is null
  );
$$;

create or replace function public.can_read_course(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_platform_access()
    or exists (
      select 1 from public.entitlements e
      where e.user_id = auth.uid()
        and e.scope_type = 'course'
        and e.course_id = target_course_id
        and e.status = 'active'
        and e.starts_at <= now()
        and (e.expires_at is null or e.expires_at > now())
    );
$$;

revoke all on function public.has_role(text) from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.has_platform_access() from public, anon;
revoke all on function public.can_read_course(uuid) from public, anon;
grant execute on function public.has_role(text), public.is_admin(),
  public.has_platform_access(), public.can_read_course(uuid) to authenticated;

-- Enable RLS on every public application table.
do $$
declare t record;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename not in ('spatial_ref_sys')
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- Profiles and roles.
create policy profiles_read_self_or_admin on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_admin());

create policy profiles_update_self on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy roles_read_authenticated on public.roles
for select to authenticated using (true);

create policy user_roles_read_self_or_admin on public.user_roles
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy user_roles_admin_manage on public.user_roles
for all to authenticated
using (public.has_role('owner_admin'))
with check (public.has_role('owner_admin'));

-- Public catalog content: published content is readable; editors/admins can read drafts.
create policy courses_read on public.courses for select to authenticated
using (status = 'published' or public.has_role('content_editor') or public.is_admin());
create policy courses_editor_manage on public.courses for all to authenticated
using (public.has_role('content_editor') or public.is_admin())
with check (public.has_role('content_editor') or public.is_admin());

create policy subjects_read on public.subjects for select to authenticated
using (
  (status = 'published' and exists (
    select 1 from public.courses c where c.id = course_id and c.status = 'published'
  )) or public.has_role('content_editor') or public.is_admin()
);
create policy subjects_editor_manage on public.subjects for all to authenticated
using (public.has_role('content_editor') or public.is_admin())
with check (public.has_role('content_editor') or public.is_admin());

create policy topics_read on public.topics for select to authenticated
using (
  (status = 'published' and exists (
    select 1 from public.subjects s join public.courses c on c.id = s.course_id
    where s.id = subject_id and s.status = 'published' and c.status = 'published'
  )) or public.has_role('content_editor') or public.is_admin()
);
create policy topics_editor_manage on public.topics for all to authenticated
using (public.has_role('content_editor') or public.is_admin())
with check (public.has_role('content_editor') or public.is_admin());

create policy media_assets_read_authenticated on public.media_assets
for select to authenticated using (true);
create policy media_assets_editor_manage on public.media_assets
for all to authenticated
using (public.has_role('content_editor') or public.is_admin())
with check (public.has_role('content_editor') or public.is_admin());

create policy lectures_read on public.lectures for select to authenticated
using (
  (status = 'published' and exists (
    select 1 from public.topics t
    join public.subjects s on s.id = t.subject_id
    join public.courses c on c.id = s.course_id
    where t.id = topic_id and t.status = 'published'
      and s.status = 'published' and c.status = 'published'
  )) or public.has_role('content_editor') or public.is_admin()
);
create policy lectures_editor_manage on public.lectures for all to authenticated
using (public.has_role('content_editor') or public.is_admin())
with check (public.has_role('content_editor') or public.is_admin());

create policy lecture_objectives_read on public.lecture_objectives
for select to authenticated using (exists (
  select 1 from public.lectures l where l.id = lecture_id and
  (l.status = 'published' or public.has_role('content_editor') or public.is_admin())
));
create policy lecture_objectives_editor_manage on public.lecture_objectives
for all to authenticated
using (public.has_role('content_editor') or public.is_admin())
with check (public.has_role('content_editor') or public.is_admin());

create policy lecture_resources_read on public.lecture_resources
for select to authenticated using (exists (
  select 1 from public.lectures l where l.id = lecture_id and
  (l.status = 'published' or public.has_role('content_editor') or public.is_admin())
));
create policy lecture_resources_editor_manage on public.lecture_resources
for all to authenticated
using (public.has_role('content_editor') or public.is_admin())
with check (public.has_role('content_editor') or public.is_admin());

-- Product catalog is visible to authenticated users; orders/transactions are private to owner/admin.
create policy active_products_read on public.access_products
for select to authenticated using (is_active or public.is_admin());
create policy product_rules_read on public.product_access_rules
for select to authenticated using (
  exists (select 1 from public.access_products p where p.id = product_id and p.is_active)
  or public.is_admin()
);
create policy orders_read_own_or_admin on public.orders
for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy transactions_read_via_order on public.payment_transactions
for select to authenticated using (public.is_admin() or exists (
  select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()
));
create policy webhook_events_admin_read on public.payment_webhook_events
for select to authenticated using (public.is_admin());
create policy refunds_read_own_or_admin on public.refunds
for select to authenticated using (public.is_admin() or exists (
  select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()
));
create policy entitlements_read_own_or_admin on public.entitlements
for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- QBank: question stems/options are available only to users with platform/course access.
create policy questions_read_access on public.questions
for select to authenticated using (
  public.is_admin() or public.has_role('content_editor')
  or (status = 'published' and public.can_read_course((
    select c.id from public.topics t
    join public.subjects s on s.id = t.subject_id
    join public.courses c on c.id = s.course_id
    where t.id = topic_id
  )))
);
create policy questions_editor_manage on public.questions
for all to authenticated
using (public.has_role('content_editor') or public.is_admin())
with check (public.has_role('content_editor') or public.is_admin());

create policy question_versions_read_access on public.question_versions
for select to authenticated using (
  public.is_admin() or public.has_role('content_editor')
  or (status = 'published' and exists (
    select 1 from public.questions q
    join public.topics t on t.id = q.topic_id
    join public.subjects s on s.id = t.subject_id
    join public.courses c on c.id = s.course_id
    where q.id = question_id and q.status = 'published'
      and t.status = 'published' and s.status = 'published'
      and c.status = 'published' and public.can_read_course(c.id)
  ))
);
create policy question_versions_editor_manage on public.question_versions
for all to authenticated
using (public.has_role('content_editor') or public.is_admin())
with check (
  (public.has_role('content_editor') or public.is_admin())
  and exists (
    select 1 from public.questions q
    where q.id = question_id and
      (q.status = 'draft' or public.is_admin())
  )
);

create policy question_options_read_access on public.question_options
for select to authenticated using (exists (
  select 1 from public.question_versions v
  where v.id = question_version_id
));
create policy question_options_editor_manage on public.question_options
for all to authenticated
using (public.has_role('content_editor') or public.is_admin())
with check (public.has_role('content_editor') or public.is_admin());

create policy question_version_topics_read on public.question_version_topics
for select to authenticated using (exists (
  select 1 from public.question_versions v where v.id = question_version_id
));
create policy question_version_topics_editor_manage on public.question_version_topics
for all to authenticated
using (public.has_role('content_editor') or public.is_admin())
with check (public.has_role('content_editor') or public.is_admin());

create policy question_tags_read on public.question_tags
for select to authenticated using (true);
create policy question_tags_editor_manage on public.question_tags
for all to authenticated
using (public.has_role('content_editor') or public.is_admin())
with check (public.has_role('content_editor') or public.is_admin());

create policy question_tag_map_read on public.question_tag_map
for select to authenticated using (exists (
  select 1 from public.question_versions v where v.id = question_version_id
));
create policy question_tag_map_editor_manage on public.question_tag_map
for all to authenticated
using (public.has_role('content_editor') or public.is_admin())
with check (public.has_role('content_editor') or public.is_admin());

create policy question_media_read on public.question_media
for select to authenticated using (exists (
  select 1 from public.question_versions v where v.id = question_version_id
));
create policy question_media_editor_manage on public.question_media
for all to authenticated
using (public.has_role('content_editor') or public.is_admin())
with check (public.has_role('content_editor') or public.is_admin());

create policy question_references_read on public.question_references
for select to authenticated using (exists (
  select 1 from public.question_versions v where v.id = question_version_id
));
create policy question_references_editor_manage on public.question_references
for all to authenticated
using (public.has_role('content_editor') or public.is_admin())
with check (public.has_role('content_editor') or public.is_admin());

-- Learner-owned records.
create policy lecture_progress_own on public.lecture_progress
for all to authenticated using (user_id = auth.uid())
with check (user_id = auth.uid());
create policy question_attempts_read_own on public.question_attempts
for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy attempt_selected_options_read_own on public.attempt_selected_options
for select to authenticated using (exists (
  select 1 from public.question_attempts a
  where a.id = attempt_id and (a.user_id = auth.uid() or public.is_admin())
));
create policy lecture_bookmarks_own on public.lecture_bookmarks
for all to authenticated using (user_id = auth.uid())
with check (user_id = auth.uid());
create policy question_bookmarks_own on public.question_bookmarks
for all to authenticated using (user_id = auth.uid())
with check (user_id = auth.uid());
create policy saved_resources_own on public.saved_resources
for all to authenticated using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Admin content.
create policy announcements_read_published on public.announcements
for select to authenticated using (
  status = 'published' and (publish_at is null or publish_at <= now())
  or public.is_admin()
);
create policy announcements_admin_manage on public.announcements
for all to authenticated using (public.is_admin())
with check (public.is_admin());
create policy audit_logs_admin_read on public.admin_audit_logs
for select to authenticated using (public.is_admin());

-- No direct client writes to payment, entitlement, attempt, or audit tables.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles, public.roles, public.user_roles,
  public.courses, public.subjects, public.topics, public.media_assets,
  public.lectures, public.lecture_objectives, public.lecture_resources,
  public.access_products, public.product_access_rules, public.orders,
  public.payment_transactions, public.payment_webhook_events, public.refunds,
  public.entitlements, public.questions, public.question_versions,
  public.question_options, public.question_version_topics, public.question_tags,
  public.question_tag_map, public.question_media, public.question_references,
  public.question_attempts, public.attempt_selected_options,
  public.admin_audit_logs, public.announcements
to authenticated;

grant insert, update on public.profiles to authenticated;
grant insert, update, delete on public.lecture_progress, public.lecture_bookmarks,
  public.question_bookmarks, public.saved_resources to authenticated;

grant insert, update, delete on public.courses, public.subjects, public.topics,
  public.media_assets, public.lectures, public.lecture_objectives,
  public.lecture_resources, public.questions, public.question_versions,
  public.question_options, public.question_version_topics, public.question_tags,
  public.question_tag_map, public.question_media, public.question_references,
  public.announcements, public.user_roles
to authenticated;

-- Private answer material is service-role-only. Never expose this schema via PostgREST.
revoke all on all tables in schema private from public, anon, authenticated;
grant select, insert, update, delete on all tables in schema private to service_role;
