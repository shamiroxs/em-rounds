-- 00012: Trusted functions for admin question management.
-- All functions are callable ONLY by the server (service_role), matching 00010.

-- ---------------------------------------------------------------------------
-- PART A: functions
-- ---------------------------------------------------------------------------

-- Staff level of a user: 'admin' (admin or owner_admin), 'editor', or 'none'.
create or replace function public.admin_actor_level(p_actor uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when bool_or(r.code in ('admin', 'owner_admin')) then 'admin'
    when bool_or(r.code = 'content_editor') then 'editor'
    else 'none'
  end
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = p_actor
$$;

-- Saves a question as a DRAFT in one transaction.
--   * p_question_id null     -> creates the question and version 1
--   * latest version = draft -> edits that draft version in place
--   * latest version = published/retired -> creates the next draft version
-- p_options: [{"label":"A","text":"..."}, ...]  (2 to 6, labels A-F)
create or replace function public.admin_save_question_draft(
  p_question_id uuid,
  p_topic_id uuid,
  p_question_code text,
  p_stem text,
  p_difficulty text,
  p_options jsonb,
  p_correct_label text,
  p_explanation text,
  p_tag_ids uuid[],
  p_actor uuid
)
returns table (
  out_question_id uuid,
  out_version_id uuid,
  out_version_number integer,
  out_created_new_version boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_level text;
  v_question public.questions%rowtype;
  v_latest public.question_versions%rowtype;
  v_version_id uuid;
  v_version_number integer;
  v_new boolean := false;
  v_option jsonb;
  v_idx integer := 0;
  v_labels text[] := '{}';
  v_label text;
  v_text text;
  v_option_id uuid;
  v_correct_id uuid;
  v_topic_status text;
  v_code text := nullif(btrim(coalesce(p_question_code, '')), '');
  v_stem text := btrim(coalesce(p_stem, ''));
  v_expl text := btrim(coalesce(p_explanation, ''));
begin
  v_level := public.admin_actor_level(p_actor);
  if v_level = 'none' then
    raise exception 'forbidden: You are not authorized to manage questions.';
  end if;

  -- Validation (the app validates too; this is the second lock).
  if length(v_stem) < 10 or length(v_stem) > 5000 then
    raise exception 'validation: The question text must be 10 to 5000 characters.';
  end if;
  if p_difficulty is null or p_difficulty not in ('easy', 'moderate', 'difficult', 'unclassified') then
    raise exception 'validation: Invalid difficulty.';
  end if;
  if length(v_expl) > 5000 then
    raise exception 'validation: The explanation must be at most 5000 characters.';
  end if;
  if v_code is not null and (length(v_code) > 40 or v_code !~ '^[A-Za-z0-9._-]+$') then
    raise exception 'validation: Invalid question code.';
  end if;
  if p_options is null or jsonb_typeof(p_options) <> 'array'
     or jsonb_array_length(p_options) not between 2 and 6 then
    raise exception 'validation: Provide 2 to 6 answer options.';
  end if;

  select t.status into v_topic_status from public.topics t where t.id = p_topic_id;
  if not found then
    raise exception 'validation: The chosen topic does not exist.';
  end if;
  if v_topic_status = 'archived' then
    raise exception 'validation: The chosen topic is archived.';
  end if;

  for v_option in select * from jsonb_array_elements(p_options) loop
    v_label := btrim(coalesce(v_option ->> 'label', ''));
    v_text := btrim(coalesce(v_option ->> 'text', ''));
    if v_label !~ '^[A-F]$' then
      raise exception 'validation: Option labels must be A to F.';
    end if;
    if v_label = any (v_labels) then
      raise exception 'validation: Duplicate option label.';
    end if;
    if length(v_text) < 1 or length(v_text) > 500 then
      raise exception 'validation: Each answer option must be 1 to 500 characters.';
    end if;
    v_labels := v_labels || v_label;
  end loop;
  if p_correct_label is null or not (p_correct_label = any (v_labels)) then
    raise exception 'validation: Choose exactly one correct answer.';
  end if;

  -- Find or create the question and the version to write into.
  if p_question_id is null then
    insert into public.questions (topic_id, question_code, status, created_by)
    values (p_topic_id, v_code, 'draft', p_actor)
    returning * into v_question;

    v_version_number := 1;
    v_new := true;
    insert into public.question_versions
      (question_id, version_number, stem, question_type, difficulty, status, created_by)
    values
      (v_question.id, 1, v_stem, 'single_best_answer', p_difficulty, 'draft', p_actor)
    returning id into v_version_id;
  else
    select * into v_question from public.questions q where q.id = p_question_id for update;
    if not found then
      raise exception 'validation: Question not found.';
    end if;
    if v_question.status = 'archived' then
      raise exception 'validation: Restore this archived question before editing it.';
    end if;
    if v_level <> 'admin' and v_question.status <> 'draft' then
      raise exception 'forbidden: Only an administrator can edit a question that is published.';
    end if;

    select * into v_latest
    from public.question_versions v
    where v.question_id = v_question.id
    order by v.version_number desc
    limit 1;

    if found and v_latest.status = 'draft' then
      v_version_id := v_latest.id;
      v_version_number := v_latest.version_number;
      update public.question_versions
         set stem = v_stem, difficulty = p_difficulty
       where id = v_version_id;
      -- Clear this DRAFT version's old content (correct-answer rows first: they reference options).
      delete from private.question_correct_options where question_version_id = v_version_id;
      delete from public.question_options where question_version_id = v_version_id;
      delete from public.question_version_topics where question_version_id = v_version_id;
      delete from public.question_tag_map where question_version_id = v_version_id;
    else
      v_version_number := coalesce(v_latest.version_number, 0) + 1;
      v_new := true;
      insert into public.question_versions
        (question_id, version_number, stem, question_type, difficulty, status, created_by)
      values
        (v_question.id, v_version_number, v_stem, 'single_best_answer', p_difficulty, 'draft', p_actor)
      returning id into v_version_id;
    end if;

    update public.questions
       set topic_id = p_topic_id, question_code = v_code
     where id = v_question.id;
  end if;

  -- Options and the single correct answer.
  for v_option in select * from jsonb_array_elements(p_options) loop
    v_idx := v_idx + 1;
    v_label := btrim(v_option ->> 'label');
    v_text := btrim(v_option ->> 'text');
    insert into public.question_options (question_version_id, option_label, option_text, sort_order)
    values (v_version_id, v_label, v_text, v_idx * 10)
    returning id into v_option_id;
    if v_label = p_correct_label then
      v_correct_id := v_option_id;
    end if;
  end loop;

  insert into private.question_correct_options (question_version_id, option_id)
  values (v_version_id, v_correct_id);

  insert into private.question_answer_keys (question_version_id)
  values (v_version_id)
  on conflict (question_version_id) do nothing;

  insert into private.question_feedback (question_version_id, explanation)
  values (v_version_id, v_expl)
  on conflict (question_version_id)
  do update set explanation = excluded.explanation, updated_at = now();

  -- Educational categories: the topic, plus any chosen tags.
  insert into public.question_version_topics (question_version_id, topic_id)
  values (v_version_id, p_topic_id);

  if p_tag_ids is not null and array_length(p_tag_ids, 1) > 0 then
    insert into public.question_tag_map (question_version_id, tag_id)
    select v_version_id, t.id from public.question_tags t where t.id = any (p_tag_ids);
  end if;

  return query select v_question.id, v_version_id, v_version_number, v_new;
end;
$$;

-- Publishes the latest version of a question (administrators only).
-- Checks completeness, retires any previously published version, publishes this one.
create or replace function public.admin_publish_question(p_question_id uuid, p_actor uuid)
returns table (out_version_id uuid, out_version_number integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_question public.questions%rowtype;
  v_latest public.question_versions%rowtype;
  v_option_count integer;
  v_correct_count integer;
  v_expl text;
begin
  if public.admin_actor_level(p_actor) <> 'admin' then
    raise exception 'forbidden: Only an administrator can publish questions.';
  end if;

  select * into v_question from public.questions q where q.id = p_question_id for update;
  if not found then
    raise exception 'validation: Question not found.';
  end if;
  if v_question.status = 'archived' then
    raise exception 'validation: Restore this archived question before publishing it.';
  end if;

  select * into v_latest
  from public.question_versions v
  where v.question_id = v_question.id
  order by v.version_number desc
  limit 1;
  if not found then
    raise exception 'validation: This question has no content yet.';
  end if;
  if v_latest.status = 'retired' then
    raise exception 'validation: The latest version is retired. Edit the question to create a new version.';
  end if;

  if length(btrim(v_latest.stem)) < 10 then
    raise exception 'validation: The question text is too short to publish.';
  end if;
  select count(*) into v_option_count
  from public.question_options o where o.question_version_id = v_latest.id;
  if v_option_count < 2 then
    raise exception 'validation: At least two answer options are required.';
  end if;
  select count(*) into v_correct_count
  from private.question_correct_options c where c.question_version_id = v_latest.id;
  if v_correct_count <> 1 then
    raise exception 'validation: Exactly one correct answer is required.';
  end if;
  select f.explanation into v_expl
  from private.question_feedback f where f.question_version_id = v_latest.id;
  if v_expl is null or btrim(v_expl) = '' then
    raise exception 'validation: Add an explanation before publishing.';
  end if;

  if v_latest.status = 'draft' then
    update public.question_versions
       set status = 'retired'
     where question_id = v_question.id and status = 'published';
    update public.question_versions
       set status = 'published', published_at = now()
     where id = v_latest.id;
  end if;

  update public.questions set status = 'published' where id = v_question.id;

  return query select v_latest.id, v_latest.version_number;
end;
$$;

-- Returns the confidential parts of a version (correct option + explanation) to STAFF only.
create or replace function public.admin_get_question_secrets(p_version_id uuid, p_actor uuid)
returns table (out_correct_option_id uuid, out_explanation text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.admin_actor_level(p_actor) = 'none' then
    raise exception 'forbidden: You are not authorized to view answer keys.';
  end if;
  return query
    select c.option_id, f.explanation
    from public.question_versions v
    left join private.question_correct_options c on c.question_version_id = v.id
    left join private.question_feedback f on f.question_version_id = v.id
    where v.id = p_version_id;
end;
$$;

revoke all on function public.admin_actor_level(uuid) from public, anon, authenticated;
revoke all on function public.admin_save_question_draft(uuid, uuid, text, text, text, jsonb, text, text, uuid[], uuid) from public, anon, authenticated;
revoke all on function public.admin_publish_question(uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_get_question_secrets(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_actor_level(uuid) to service_role;
grant execute on function public.admin_save_question_draft(uuid, uuid, text, text, text, jsonb, text, text, uuid[], uuid) to service_role;
grant execute on function public.admin_publish_question(uuid, uuid) to service_role;
grant execute on function public.admin_get_question_secrets(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- PART B: allow ONE narrow change to a published version: published -> retired.
-- Question text, options, difficulty and every other column stay frozen.
-- (Also fixes DELETE of draft versions, which previously returned NULL and was skipped.)
-- ---------------------------------------------------------------------------
create or replace function public.guard_published_question_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'published' then
    if tg_op = 'UPDATE'
       and new.status = 'retired'
       and new.id = old.id
       and new.question_id = old.question_id
       and new.version_number = old.version_number
       and new.stem = old.stem
       and new.question_type = old.question_type
       and new.difficulty = old.difficulty
       and new.published_at is not distinct from old.published_at
       and new.created_by is not distinct from old.created_by
       and new.created_at = old.created_at then
      return new;
    end if;
    raise exception 'Published question versions are immutable; create a new version';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- PART C (OPTIONAL hardening, from Milestone 5): content editors may change
-- learning objectives and resources only for DRAFT lectures. Admins unchanged.
-- Skip this part if you prefer; the app already enforces the same rule.
-- ---------------------------------------------------------------------------
drop policy if exists lecture_objectives_editor_manage on public.lecture_objectives;
create policy lecture_objectives_editor_manage on public.lecture_objectives
for all to authenticated
using (
  public.is_admin()
  or (public.has_role('content_editor') and exists (
    select 1 from public.lectures l where l.id = lecture_id and l.status = 'draft'))
)
with check (
  public.is_admin()
  or (public.has_role('content_editor') and exists (
    select 1 from public.lectures l where l.id = lecture_id and l.status = 'draft'))
);

drop policy if exists lecture_resources_editor_manage on public.lecture_resources;
create policy lecture_resources_editor_manage on public.lecture_resources
for all to authenticated
using (
  public.is_admin()
  or (public.has_role('content_editor') and exists (
    select 1 from public.lectures l where l.id = lecture_id and l.status = 'draft'))
)
with check (
  public.is_admin()
  or (public.has_role('content_editor') and exists (
    select 1 from public.lectures l where l.id = lecture_id and l.status = 'draft'))
);

-- Make the new functions visible to the API immediately.
notify pgrst, 'reload schema';