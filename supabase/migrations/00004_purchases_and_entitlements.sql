-- 00004: One-time purchases and entitlement ledger.
create table public.access_products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  amount_minor bigint check (amount_minor is null or amount_minor > 0),
  currency char(3) not null default 'INR' check (currency = 'INR'),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_access_rules (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.access_products(id) on delete cascade,
  scope_type text not null check (scope_type in ('platform','course')),
  course_id uuid references public.courses(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (
    (scope_type = 'platform' and course_id is null)
    or (scope_type = 'course' and course_id is not null)
  ),
  unique (product_id, scope_type, course_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  product_id uuid not null references public.access_products(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'INR' check (currency = 'INR'),
  status text not null default 'created'
    check (status in ('created','pending','paid','failed','partially_refunded','refunded','cancelled')),
  provider text not null default 'razorpay',
  provider_order_id text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null,
  provider_payment_id text unique,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'INR' check (currency = 'INR'),
  status text not null check (status in ('created','authorized','captured','failed','refunded')),
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  processing_status text not null default 'received'
    check (processing_status in ('received','processing','processed','failed','ignored')),
  payload_sanitized jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text,
  unique (provider, provider_event_id)
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider_refund_id text unique,
  amount_minor bigint not null check (amount_minor > 0),
  status text not null default 'pending' check (status in ('pending','processed','failed')),
  reason text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  source_order_id uuid references public.orders(id) on delete restrict,
  scope_type text not null check (scope_type in ('platform','course')),
  course_id uuid references public.courses(id) on delete restrict,
  status text not null default 'active' check (status in ('active','revoked')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope_type = 'platform' and course_id is null)
    or (scope_type = 'course' and course_id is not null)
  ),
  check ((status = 'active' and revoked_at is null) or status = 'revoked')
);

create unique index one_entitlement_per_order_scope
on public.entitlements (
  source_order_id,
  scope_type,
  (coalesce(course_id, '00000000-0000-0000-0000-000000000000'::uuid))
)
where source_order_id is not null;

create trigger access_products_set_updated_at before update on public.access_products
for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();
create trigger entitlements_set_updated_at before update on public.entitlements
for each row execute function public.set_updated_at();
