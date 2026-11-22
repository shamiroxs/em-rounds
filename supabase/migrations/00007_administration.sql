-- 00007: Announcements and append-only audit log.
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  publish_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.prevent_audit_log_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Audit log entries are append-only';
end;
$$;

create trigger audit_log_no_update
before update or delete on public.admin_audit_logs
for each row execute function public.prevent_audit_log_mutation();

create trigger announcements_set_updated_at before update on public.announcements
for each row execute function public.set_updated_at();
