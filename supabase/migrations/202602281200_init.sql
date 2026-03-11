create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  parent_name text not null,
  email text not null,
  phone text not null,
  player_age text not null,
  player_level text not null,
  city text not null,
  goal text not null,
  availability text not null,
  consent boolean not null,
  status text not null default 'pending',
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_status_idx on public.leads (status);

create table if not exists public.stripe_events (
  event_id text primary key,
  created_at timestamptz not null default now(),
  payload jsonb not null
);

alter table public.leads enable row level security;
alter table public.stripe_events enable row level security;

drop policy if exists "service role can manage leads" on public.leads;
create policy "service role can manage leads"
  on public.leads
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role can manage stripe events" on public.stripe_events;
create policy "service role can manage stripe events"
  on public.stripe_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
