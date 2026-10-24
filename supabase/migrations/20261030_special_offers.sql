-- Offres spéciales envoyées à une famille (ex. 2 pour 1 pour deux sœurs) : une page
-- d'offre avec date d'expiration ; le paiement inscrit toutes les joueuses visées.
create table if not exists public.special_offers (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  title text not null,
  description text,
  parent_name text,
  parent_email text,
  amount_cents integer not null,
  regular_amount_cents integer,
  registrations jsonb not null default '[]'::jsonb,
  expires_at timestamptz not null,
  paid_at timestamptz,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now()
);

alter table public.special_offers enable row level security;
create policy special_offers_service_role_all on public.special_offers
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
