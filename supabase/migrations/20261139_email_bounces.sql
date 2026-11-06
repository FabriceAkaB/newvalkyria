-- Courriels refusés (rebonds lus dans info@) : JP le voit dans Aujourd'hui le jour même.
create table if not exists public.email_bounces (
  id bigint generated always as identity primary key,
  club_id text not null default 'new-valkyria',
  message_id text not null unique,
  bounced_at timestamptz not null,
  recipient text,
  subject text,
  reason text,
  kind text not null default 'autre',
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists email_bounces_at_idx on public.email_bounces (bounced_at desc);
alter table public.email_bounces enable row level security;
do $$ begin
  create policy email_bounces_service_role_all on public.email_bounces for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
exception when duplicate_object then null; end $$;
