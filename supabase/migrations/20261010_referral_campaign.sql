-- Campagne « Partagez New Valkyria » : journal des envois (jamais deux fois la
-- même famille pour la même campagne) et liste des désabonnés.
create table if not exists public.referral_campaign_sends (
  id uuid primary key default gen_random_uuid(),
  campaign text not null,
  email text not null,
  status text not null check (status in ('sent', 'failed')),
  error text,
  sent_at timestamptz not null default now(),
  unique (campaign, email)
);
create table if not exists public.referral_campaign_optouts (
  email text primary key,
  created_at timestamptz not null default now()
);
alter table public.referral_campaign_sends enable row level security;
alter table public.referral_campaign_optouts enable row level security;
create policy referral_campaign_sends_service_role_all on public.referral_campaign_sends for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy referral_campaign_optouts_service_role_all on public.referral_campaign_optouts for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
