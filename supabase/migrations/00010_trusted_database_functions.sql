-- 00010: Trusted server-side operations.
-- Call only after server-side authorization and provider webhook verification.
create or replace function public.grant_entitlements_for_paid_order(target_order_id uuid)
returns setof public.entitlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders%rowtype;
  rule_row record;
  result_row public.entitlements%rowtype;
begin
  select * into order_row from public.orders where id = target_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if order_row.status <> 'paid' then raise exception 'Order is not paid'; end if;

  for rule_row in
    select scope_type, course_id from public.product_access_rules
    where product_id = order_row.product_id
  loop
    insert into public.entitlements (
      user_id, source_order_id, scope_type, course_id, status, starts_at, expires_at
    ) values (
      order_row.user_id, order_row.id, rule_row.scope_type, rule_row.course_id,
      'active', now(), null
    )
    on conflict do nothing;

    select * into result_row
    from public.entitlements e
    where e.source_order_id = order_row.id
      and e.scope_type = rule_row.scope_type
      and e.course_id is not distinct from rule_row.course_id
    limit 1;
    return next result_row;
  end loop;
  return;
end;
$$;

create or replace function public.process_full_refund_and_revoke(
  target_refund_id uuid,
  reason_text text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  refund_row public.refunds%rowtype;
  order_row public.orders%rowtype;
begin
  select * into refund_row from public.refunds
  where id = target_refund_id for update;
  if not found then raise exception 'Refund not found'; end if;

  select * into order_row from public.orders
  where id = refund_row.order_id for update;
  if not found then raise exception 'Order not found'; end if;

  if refund_row.status <> 'processed' then
    raise exception 'Refund must be provider-confirmed as processed first';
  end if;

  if refund_row.amount_minor <> order_row.amount_minor then
    raise exception 'Only a full refund revokes platform access in this function';
  end if;

  update public.entitlements
  set status = 'revoked',
      revoked_at = now(),
      revoke_reason = coalesce(reason_text, 'Full refund')
  where source_order_id = order_row.id and status = 'active';

  update public.orders set status = 'refunded', updated_at = now()
  where id = order_row.id;
end;
$$;

-- Question submission is performed by a trusted server after it validates the
-- authenticated user and request. The service role must not be exposed to clients.
create or replace function public.record_question_attempt(
  target_user_id uuid,
  target_question_version_id uuid,
  selected_option_ids uuid[],
  response_seconds integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  question_row public.question_versions%rowtype;
  correct_ids uuid[];
  selected_ids uuid[];
  is_answer_correct boolean;
  attempt_id uuid;
  explanation_text text;
begin
  if target_user_id is null then raise exception 'User is required'; end if;
  if coalesce(array_length(selected_option_ids, 1), 0) = 0 then
    raise exception 'Select at least one option';
  end if;

  select * into question_row
  from public.question_versions
  where id = target_question_version_id and status = 'published';
  if not found then raise exception 'Published question version not found'; end if;

-- Verify that the learner has access to the question's course.
if not exists (
  select 1
  from public.questions q
  join public.topics t on t.id = q.topic_id
  join public.subjects sub on sub.id = t.subject_id
  join public.courses c on c.id = sub.course_id
  where q.id = question_row.question_id
    and q.status = 'published'
    and t.status = 'published'
    and sub.status = 'published'
    and c.status = 'published'
    and exists (
      select 1
      from public.entitlements e
      where e.user_id = target_user_id
        and e.status = 'active'
        and e.starts_at <= now()
        and (e.expires_at is null or e.expires_at > now())
        and (
          e.scope_type = 'platform'
          or (e.scope_type = 'course' and e.course_id = c.id)
        )
    )
) then
  raise exception 'Learner does not have access to this published question';
end if;

  if exists (
    select 1 from unnest(selected_option_ids) selected_id
    where not exists (
      select 1 from public.question_options o
      where o.id = selected_id and o.question_version_id = target_question_version_id
    )
  ) then raise exception 'One or more selected options do not belong to this question'; end if;

  select array_agg(distinct x order by x) into selected_ids
  from unnest(selected_option_ids) x;
  select array_agg(c.option_id order by c.option_id) into correct_ids
  from private.question_correct_options c
  where c.question_version_id = target_question_version_id;

  if coalesce(array_length(correct_ids, 1), 0) = 0 then
    raise exception 'Question answer key is not configured';
  end if;

  is_answer_correct := selected_ids = correct_ids;

  insert into public.question_attempts (
    user_id, question_version_id, is_correct, response_time_seconds
  ) values (
    target_user_id, target_question_version_id, is_answer_correct, response_seconds
  ) returning id into attempt_id;

  insert into public.attempt_selected_options (attempt_id, option_id)
  select attempt_id, x from unnest(selected_ids) x;

  select explanation into explanation_text
  from private.question_feedback
  where question_version_id = target_question_version_id;

  return jsonb_build_object(
    'attempt_id', attempt_id,
    'is_correct', is_answer_correct,
    'correct_option_ids', correct_ids,
    'explanation', explanation_text
  );
end;
$$;

-- Functions are callable only by the trusted server role. Do not grant them to
-- authenticated/anon. Your server must enforce the caller's identity and access.
revoke all on function public.grant_entitlements_for_paid_order(uuid) from public, anon, authenticated;
revoke all on function public.process_full_refund_and_revoke(uuid,text) from public, anon, authenticated;
revoke all on function public.record_question_attempt(uuid,uuid,uuid[],integer) from public, anon, authenticated;
grant execute on function public.grant_entitlements_for_paid_order(uuid) to service_role;
grant execute on function public.process_full_refund_and_revoke(uuid,text) to service_role;
grant execute on function public.record_question_attempt(uuid,uuid,uuid[],integer) to service_role;
