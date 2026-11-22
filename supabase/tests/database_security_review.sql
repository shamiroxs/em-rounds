-- Structural security assertions. These do not replace real JWT/RLS tests.
do $$
begin
  if has_table_privilege('anon', 'private.question_answer_keys', 'SELECT') then
    raise exception 'anon unexpectedly has access to private answer keys';
  end if;

  if has_table_privilege('authenticated', 'private.question_answer_keys', 'SELECT') then
    raise exception 'authenticated unexpectedly has access to private answer keys';
  end if;

  if has_function_privilege('authenticated',
      'public.record_question_attempt(uuid,uuid,uuid[],integer)', 'EXECUTE') then
    raise exception 'authenticated can call trusted attempt function directly';
  end if;

  if has_table_privilege('authenticated', 'public.entitlements', 'INSERT') then
    raise exception 'authenticated can insert entitlements directly';
  end if;

  if has_table_privilege('authenticated', 'public.orders', 'INSERT') then
    raise exception 'authenticated can insert orders directly';
  end if;
end $$;
