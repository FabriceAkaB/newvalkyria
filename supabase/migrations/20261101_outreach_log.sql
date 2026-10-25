-- Journal des relances envoyées aux familles (courriels de relance, offres, excuses),
-- pour savoir combien de fois chaque famille a été relancée et qui s'est inscrit ensuite.
create table if not exists public.outreach_log (
  id uuid primary key default gen_random_uuid(),
  sent_at timestamptz not null default now(),
  parent_name text,
  parent_email text not null,
  player_name text,
  registration_id uuid,
  campaign text not null,
  subject text,
  offer_token text,
  kind text not null default 'relance' check (kind in ('relance', 'reponse', 'excuse', 'erreur')),
  notes text
);

create index if not exists outreach_log_email_idx on public.outreach_log (lower(parent_email));

alter table public.outreach_log enable row level security;
create policy outreach_log_service_role_all on public.outreach_log
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
