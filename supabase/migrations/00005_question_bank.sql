-- 00005: Public question metadata; confidential answer material in private schema.
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete restrict,
  question_code text unique,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.question_versions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  stem text not null,
  question_type text not null default 'single_best_answer'
    check (question_type in ('single_best_answer','multiple_select')),
  difficulty text not null default 'unclassified'
    check (difficulty in ('easy','moderate','difficult','unclassified')),
  status text not null default 'draft' check (status in ('draft','published','retired')),
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (question_id, version_number),
  unique (question_id, id)
);

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_version_id uuid not null references public.question_versions(id) on delete cascade,
  option_label text not null,
  option_text text not null,
  sort_order integer not null default 0,
  unique (question_version_id, id),
  unique (question_version_id, option_label)
);

create table public.question_version_topics (
  question_version_id uuid not null references public.question_versions(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete restrict,
  primary key (question_version_id, topic_id)
);

create table public.question_tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null
);

create table public.question_tag_map (
  question_version_id uuid not null references public.question_versions(id) on delete cascade,
  tag_id uuid not null references public.question_tags(id) on delete cascade,
  primary key (question_version_id, tag_id)
);

create table public.question_media (
  id uuid primary key default gen_random_uuid(),
  question_version_id uuid not null references public.question_versions(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete restrict,
  caption text,
  sort_order integer not null default 0
);

create table public.question_references (
  id uuid primary key default gen_random_uuid(),
  question_version_id uuid not null references public.question_versions(id) on delete cascade,
  citation text not null,
  url text,
  sort_order integer not null default 0
);

create table private.question_answer_keys (
  question_version_id uuid primary key references public.question_versions(id) on delete restrict,
  answer_note text,
  created_at timestamptz not null default now()
);

create table private.question_correct_options (
  question_version_id uuid not null,
  option_id uuid not null,
  primary key (question_version_id, option_id),
  foreign key (question_version_id, option_id)
    references public.question_options(question_version_id, id) on delete restrict
);

create table private.question_feedback (
  question_version_id uuid primary key references public.question_versions(id) on delete restrict,
  explanation text not null,
  updated_at timestamptz not null default now()
);

create trigger questions_set_updated_at before update on public.questions
for each row execute function public.set_updated_at();
