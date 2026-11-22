-- 00002: User profiles and role model.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id smallint generated always as identity primary key,
  code text not null unique check (code in ('student','content_editor','admin','owner_admin')),
  description text not null
);

insert into public.roles (code, description) values
 ('student','Default learner role'),
 ('content_editor','Can prepare and maintain educational content'),
 ('admin','Platform administrator'),
 ('owner_admin','Highest-level platform owner')
on conflict (code) do nothing;

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id smallint not null references public.roles(id) on delete restrict,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  student_role_id smallint;
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  select id into student_role_id from public.roles where code = 'student';
  insert into public.user_roles (user_id, role_id)
  values (new.id, student_role_id)
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
