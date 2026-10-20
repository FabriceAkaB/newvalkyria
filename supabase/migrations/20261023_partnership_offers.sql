-- Propositions de partenariat personnalisées (ex. Alowa, Action Sport Physio) : chaque entreprise
-- reçoit une page privée avec ses options et un bouton de paiement Stripe par option.
-- Une option peut viser un emplacement du chandail (sponsor_slots_2027) : un emplacement ne se vend
-- jamais deux fois (dès qu'il est vendu, toutes les autres offres sur cet emplacement se ferment).
create table if not exists public.partnership_offers (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  company_name text not null,
  contact_name text,
  contact_email text not null,
  cc_email text,
  intro text,
  terms_note text,
  respond_by date,
  pdf_path text,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'declined', 'expired')),
  sponsor_id uuid references public.sponsors(id) on delete set null,
  sent_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partnership_offer_options (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.partnership_offers(id) on delete cascade,
  label text not null,
  tagline text,
  price_cents integer check (price_cents is null or price_cents >= 0),
  catalog_price_cents integer,
  benefits text[] not null default '{}',
  slot_key text references public.sponsor_slots_2027(slot_key),
  sort_order integer not null default 0,
  status text not null default 'open' check (status in ('open', 'paid', 'unavailable', 'closed')),
  payment_link_id text,
  payment_link_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_partnership_options_offer on public.partnership_offer_options(offer_id);
create index if not exists idx_partnership_options_slot on public.partnership_offer_options(slot_key) where slot_key is not null;

alter table public.partnership_offers enable row level security;
alter table public.partnership_offer_options enable row level security;
create policy partnership_offers_service_role_all on public.partnership_offers for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy partnership_offer_options_service_role_all on public.partnership_offer_options for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
