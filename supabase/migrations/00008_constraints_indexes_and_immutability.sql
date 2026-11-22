-- 00008: Supporting indexes and published-version immutability.
create index subjects_course_idx on public.subjects(course_id);
create index topics_subject_idx on public.topics(subject_id);
create index lectures_topic_idx on public.lectures(topic_id);
create index questions_topic_idx on public.questions(topic_id);
create index question_versions_question_status_idx on public.question_versions(question_id, status);
create index question_options_version_sort_idx on public.question_options(question_version_id, sort_order);
create index question_attempts_user_date_idx on public.question_attempts(user_id, submitted_at desc);
create index question_attempts_version_idx on public.question_attempts(question_version_id);
create index entitlements_user_status_idx on public.entitlements(user_id, status);
create index orders_user_date_idx on public.orders(user_id, created_at desc);
create index refunds_order_idx on public.refunds(order_id);
create index lecture_progress_user_idx on public.lecture_progress(user_id);
create index admin_audit_logs_created_idx on public.admin_audit_logs(created_at desc);

create or replace function public.guard_published_question_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'published' then
    raise exception 'Published question versions are immutable; create a new version';
  end if;
  return new;
end;
$$;

create trigger question_version_immutable
before update or delete on public.question_versions
for each row execute function public.guard_published_question_version();

create or replace function public.guard_published_question_children()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  version_status text;
  version_id uuid;
begin
  version_id := coalesce(new.question_version_id, old.question_version_id);
  select status into version_status
  from public.question_versions where id = version_id;

  if version_status = 'published' then
    raise exception 'Options/media/references for published versions are immutable';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger question_options_immutable
before insert or update or delete on public.question_options
for each row execute function public.guard_published_question_children();
create trigger question_media_immutable
before insert or update or delete on public.question_media
for each row execute function public.guard_published_question_children();
create trigger question_references_immutable
before insert or update or delete on public.question_references
for each row execute function public.guard_published_question_children();
