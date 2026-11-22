-- 00006: Learner progress, attempts, bookmarks, and saved resources.
create table public.lecture_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lecture_id uuid not null references public.lectures(id) on delete cascade,
  progress_seconds integer not null default 0 check (progress_seconds >= 0),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, lecture_id)
);

create table public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_version_id uuid not null references public.question_versions(id) on delete restrict,
  is_correct boolean not null,
  submitted_at timestamptz not null default now(),
  response_time_seconds integer check (response_time_seconds is null or response_time_seconds >= 0)
);

create table public.attempt_selected_options (
  attempt_id uuid not null references public.question_attempts(id) on delete cascade,
  option_id uuid not null references public.question_options(id) on delete restrict,
  primary key (attempt_id, option_id)
);

create table public.lecture_bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  lecture_id uuid not null references public.lectures(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, lecture_id)
);

create table public.question_bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

create table public.saved_resources (
  user_id uuid not null references auth.users(id) on delete cascade,
  lecture_resource_id uuid not null references public.lecture_resources(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, lecture_resource_id)
);

create trigger lecture_progress_set_updated_at before update on public.lecture_progress
for each row execute function public.set_updated_at();
