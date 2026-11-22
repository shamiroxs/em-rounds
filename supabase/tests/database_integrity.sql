-- Run after migrations in a development database.
do $$
declare
  required_tables text[] := array[
    'profiles','roles','user_roles','courses','subjects','topics','lectures',
    'access_products','product_access_rules','orders','payment_transactions',
    'payment_webhook_events','refunds','entitlements','questions',
    'question_versions','question_options','lecture_progress',
    'question_attempts','attempt_selected_options','announcements','admin_audit_logs'
  ];
  missing text[];
begin
  select array_agg(t) into missing
  from unnest(required_tables) t
  where not exists (
    select 1 from information_schema.tables x
    where x.table_schema = 'public' and x.table_name = t
  );
  if missing is not null then
    raise exception 'Missing required tables: %', missing;
  end if;

  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'private' and table_name = 'question_answer_keys'
  ) then
    raise exception 'Private answer key table is missing';
  end if;

  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity = false
  ) then
    raise exception 'At least one public table has RLS disabled';
  end if;
end $$;
