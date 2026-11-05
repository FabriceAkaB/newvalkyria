-- Courriels programmés (envoyés à l'heure voulue par le cron horaire) : ex. « prévenir les parents demain 8 h ».
create table if not exists public.scheduled_emails (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  send_at timestamptz not null,
  to_email text not null,
  cc text,
  subject text not null,
  html text not null,
  text_body text,
  campaign text,
  parent_name text,
  player_name text,
  status text not null default 'en_attente' check (status in ('en_attente', 'envoye', 'annule', 'echec')),
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists scheduled_emails_due_idx on public.scheduled_emails (status, send_at);
alter table public.scheduled_emails enable row level security;
do $$ begin
  create policy scheduled_emails_service_role_all on public.scheduled_emails for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
exception when duplicate_object then null; end $$;
