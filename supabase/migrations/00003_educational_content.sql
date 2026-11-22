-- 00003: Courses, subjects, topics, lectures, and media metadata.
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete restrict,
  slug text not null,
  title text not null,
  description text,
  sort_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, slug)
);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete restrict,
  parent_topic_id uuid references public.topics(id) on delete restrict,
  slug text not null,
  title text not null,
  description text,
  sort_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject_id, slug),
  check (parent_topic_id is null or parent_topic_id <> id)
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('mux','supabase_storage','external')),
  provider_asset_id text,
  storage_path text,
  media_type text not null check (media_type in ('video','image','audio','document','other')),
  title text,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (provider <> 'supabase_storage' or storage_path is not null)
);

create table public.lectures (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete restrict,
  media_asset_id uuid references public.media_assets(id) on delete set null,
  slug text not null,
  title text not null,
  description text,
  transcript text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (topic_id, slug)
);

create table public.lecture_objectives (
  id uuid primary key default gen_random_uuid(),
  lecture_id uuid not null references public.lectures(id) on delete cascade,
  objective text not null,
  sort_order integer not null default 0
);

create table public.lecture_resources (
  id uuid primary key default gen_random_uuid(),
  lecture_id uuid not null references public.lectures(id) on delete cascade,
  title text not null,
  description text,
  media_asset_id uuid references public.media_assets(id) on delete set null,
  external_url text,
  sort_order integer not null default 0,
  check (media_asset_id is not null or external_url is not null)
);

create trigger courses_set_updated_at before update on public.courses
for each row execute function public.set_updated_at();
create trigger subjects_set_updated_at before update on public.subjects
for each row execute function public.set_updated_at();
create trigger topics_set_updated_at before update on public.topics
for each row execute function public.set_updated_at();
create trigger lectures_set_updated_at before update on public.lectures
for each row execute function public.set_updated_at();
