
-- =====================================================
-- 00011: ACCESS CONTROL AND EDITOR POLICY HARDENING
-- =====================================================

-- 1. Prevent duplicate access rules.
create unique index if not exists one_platform_rule_per_product
on public.product_access_rules(product_id)
where scope_type = 'platform';

create unique index if not exists one_course_rule_per_product
on public.product_access_rules(product_id, course_id)
where scope_type = 'course';


-- 2. Content editors can manage drafts only.
-- Administrators retain publishing privileges.

drop policy if exists courses_editor_manage on public.courses;

create policy courses_editor_manage on public.courses
for all to authenticated
using (
  public.is_admin()
  or (public.has_role('content_editor') and status = 'draft')
)
with check (
  public.is_admin()
  or (public.has_role('content_editor') and status = 'draft')
);


drop policy if exists subjects_editor_manage on public.subjects;

create policy subjects_editor_manage on public.subjects
for all to authenticated
using (
  public.is_admin()
  or (public.has_role('content_editor') and status = 'draft')
)
with check (
  public.is_admin()
  or (public.has_role('content_editor') and status = 'draft')
);


drop policy if exists topics_editor_manage on public.topics;

create policy topics_editor_manage on public.topics
for all to authenticated
using (
  public.is_admin()
  or (public.has_role('content_editor') and status = 'draft')
)
with check (
  public.is_admin()
  or (public.has_role('content_editor') and status = 'draft')
);


drop policy if exists lectures_editor_manage on public.lectures;

create policy lectures_editor_manage on public.lectures
for all to authenticated
using (
  public.is_admin()
  or (public.has_role('content_editor') and status = 'draft')
)
with check (
  public.is_admin()
  or (public.has_role('content_editor') and status = 'draft')
);


-- 3. Published lectures require active course access.

drop policy if exists lectures_read on public.lectures;

create policy lectures_read on public.lectures
for select to authenticated
using (
  public.is_admin()
  or public.has_role('content_editor')
  or (
    status = 'published'
    and exists (
      select 1
      from public.topics t
      join public.subjects sub on sub.id = t.subject_id
      join public.courses c on c.id = sub.course_id
      where t.id = topic_id
        and t.status = 'published'
        and sub.status = 'published'
        and c.status = 'published'
        and public.can_read_course(c.id)
    )
  )
);


-- 4. Lecture objectives require course access.

drop policy if exists lecture_objectives_read
on public.lecture_objectives;

create policy lecture_objectives_read
on public.lecture_objectives
for select to authenticated
using (
  exists (
    select 1
    from public.lectures l
    join public.topics t on t.id = l.topic_id
    join public.subjects sub on sub.id = t.subject_id
    join public.courses c on c.id = sub.course_id
    where l.id = lecture_id
      and l.status = 'published'
      and t.status = 'published'
      and sub.status = 'published'
      and c.status = 'published'
      and (
        public.is_admin()
        or public.has_role('content_editor')
        or public.can_read_course(c.id)
      )
  )
);


-- 5. Lecture resources require course access.

drop policy if exists lecture_resources_read
on public.lecture_resources;

create policy lecture_resources_read
on public.lecture_resources
for select to authenticated
using (
  exists (
    select 1
    from public.lectures l
    join public.topics t on t.id = l.topic_id
    join public.subjects sub on sub.id = t.subject_id
    join public.courses c on c.id = sub.course_id
    where l.id = lecture_id
      and l.status = 'published'
      and t.status = 'published'
      and sub.status = 'published'
      and c.status = 'published'
      and (
        public.is_admin()
        or public.has_role('content_editor')
        or public.can_read_course(c.id)
      )
  )
);


-- 6. Media metadata is not publicly readable by every student.
-- Authorized media delivery should be handled by the backend.

drop policy if exists media_assets_read_authenticated
on public.media_assets;

create policy media_assets_read_editor_admin
on public.media_assets
for select to authenticated
using (
  public.has_role('content_editor')
  or public.is_admin()
);


-- 7. Content editors can manage only draft questions.

drop policy if exists questions_editor_manage
on public.questions;

create policy questions_editor_manage
on public.questions
for all to authenticated
using (
  public.is_admin()
  or (public.has_role('content_editor') and status = 'draft')
)
with check (
  public.is_admin()
  or (public.has_role('content_editor') and status = 'draft')
);


-- 8. Question versions must belong to draft questions
-- when edited by content editors.

drop policy if exists question_versions_editor_manage
on public.question_versions;

create policy question_versions_editor_manage
on public.question_versions
for all to authenticated
using (
  public.is_admin()
  or (
    public.has_role('content_editor')
    and status = 'draft'
    and exists (
      select 1
      from public.questions q
      where q.id = question_id
        and q.status = 'draft'
    )
  )
)
with check (
  public.is_admin()
  or (
    public.has_role('content_editor')
    and status = 'draft'
    and exists (
      select 1
      from public.questions q
      where q.id = question_id
        and q.status = 'draft'
    )
  )
);


-- 9. Restore SELECT permissions for student progress/bookmarks.
-- RLS still restricts each user to their own records.

grant select on
  public.lecture_progress,
  public.lecture_bookmarks,
  public.question_bookmarks,
  public.saved_resources
to authenticated;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
