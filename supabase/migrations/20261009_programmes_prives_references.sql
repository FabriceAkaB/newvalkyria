-- Programmes garçons privés (non répertoriés), paiement en 1 ou 2 versements,
-- référencement entre familles (rabais de 50 $, récompense sac ou crédit de
-- 50 $) et registre de crédits. Additif seulement : on réutilise
-- session_programs / session_program_registrations / session_program_payment_plans.

-- ── session_programs : réglages propres aux programmes privés ──
alter table public.session_programs add column if not exists is_private boolean not null default false;
alter table public.session_programs add column if not exists practices_count integer;
alter table public.session_programs add column if not exists matches_count integer;
-- Supplément total quand le paiement est fractionné (réparti en 2 versements égaux).
alter table public.session_programs add column if not exists installment_fee_cents integer not null default 0;
alter table public.session_programs add column if not exists referral_discount_cents integer not null default 0;
-- Années de naissance admissibles (ex. {'2018'} ou {'2014','2015'}).
alter table public.session_programs add column if not exists eligible_birth_years text[];
-- Date du 2e versement : configurable, à valider (null = 30 jours après l'inscription).
alter table public.session_programs add column if not exists second_installment_date date;
-- Contenu de la page : objectifs, avantages, lieux, entraîneurs, notes à valider.
alter table public.session_programs add column if not exists presentation jsonb not null default '{}';

-- ── session_program_registrations : détails de prix, option de paiement, réservation ──
alter table public.session_program_registrations add column if not exists payment_option text check (payment_option in ('full', 'two_installments'));
alter table public.session_program_registrations add column if not exists list_price_cents integer;
alter table public.session_program_registrations add column if not exists referral_discount_cents integer not null default 0;
alter table public.session_program_registrations add column if not exists credit_applied_cents integer not null default 0;
alter table public.session_program_registrations add column if not exists installment_fee_cents integer not null default 0;
alter table public.session_program_registrations add column if not exists total_due_cents integer;
alter table public.session_program_registrations add column if not exists birth_year integer;
alter table public.session_program_registrations add column if not exists auto_debit_consent boolean not null default false;
-- Une place « pending » ne bloque la capacité que jusqu'à cette date.
alter table public.session_program_registrations add column if not exists reservation_expires_at timestamptz;
create index if not exists idx_session_program_regs_slug_status on public.session_program_registrations(program_slug, status);

-- ── Codes de référencement : un code par famille (clé = courriel du parent) ──
create table if not exists public.referral_codes (
  code text primary key,
  family_email text not null unique,
  family_name text,
  created_at timestamptz not null default now()
);

-- ── Recommandations : une ligne par inscription référée ──
create table if not exists public.program_referrals (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references public.session_program_registrations(id) on delete cascade,
  program_slug text not null,
  referrer_code text references public.referral_codes(code),
  referrer_email text,
  referrer_name text,
  claimed_referrer_name text,
  claimed_player_name text,
  claimed_contact text,
  match_method text not null default 'aucune' check (match_method in ('code', 'courriel', 'nom', 'ambigu', 'aucune')),
  status text not null default 'a_verifier' check (status in ('a_verifier', 'confirme', 'valide', 'rejete', 'annule')),
  discount_cents integer not null default 0,
  reward_status text not null default 'aucune' check (reward_status in ('aucune', 'a_choisir', 'sac_a_remettre', 'sac_remis', 'credit_accorde', 'annulee')),
  reward_choice text check (reward_choice in ('sac', 'credit')),
  reward_chosen_at timestamptz,
  bag_delivered_at timestamptz,
  bag_delivered_by text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_program_referrals_referrer on public.program_referrals(referrer_email);
create index if not exists idx_program_referrals_status on public.program_referrals(status);

-- ── Registre de crédits familiaux (jamais un solde stocké : somme du registre) ──
create table if not exists public.family_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  family_email text not null,
  delta_cents integer not null,
  kind text not null check (kind in ('recompense', 'utilisation', 'annulation_utilisation', 'correction', 'rabais_verification')),
  referral_id uuid references public.program_referrals(id),
  registration_id uuid references public.session_program_registrations(id),
  note text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists idx_family_credit_ledger_email on public.family_credit_ledger(family_email);

-- ── Historique des corrections administratives ──
create table if not exists public.referral_audit (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid references public.program_referrals(id) on delete cascade,
  action text not null,
  actor text,
  detail jsonb,
  created_at timestamptz not null default now()
);

alter table public.referral_codes enable row level security;
alter table public.program_referrals enable row level security;
alter table public.family_credit_ledger enable row level security;
alter table public.referral_audit enable row level security;
create policy referral_codes_service_role_all on public.referral_codes for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy program_referrals_service_role_all on public.program_referrals for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy family_credit_ledger_service_role_all on public.family_credit_ledger for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy referral_audit_service_role_all on public.referral_audit for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- ── Les deux programmes privés (horaires/lieux/dates à valider : volontairement vides) ──
insert into public.session_programs (slug, name, gender, birth_years, price_cents, max_capacity, description, active, is_private, practices_count, matches_count, installment_fee_cents, referral_discount_cents, eligible_birth_years, presentation)
values
  ('garcons-2018', 'Programme de développement garçons 2018', 'garcons', '2018', 37500, 12,
   'Programme de développement technique pour garçons nés en 2018 : 16 pratiques et 3 matchs, groupe limité à 12 joueurs.',
   true, true, 16, 3, 4000, 5000, array['2018'],
   '{"calendrier_a_valider": true, "lieu_a_valider": true}'::jsonb),
  ('garcons-2014-2015', 'Programme de développement garçons 2014–2015', 'garcons', '2014-2015', 58500, 12,
   'Programme de développement pour garçons nés en 2014 et 2015 : 16 pratiques et 3 matchs, groupe limité à 12 joueurs.',
   true, true, 16, 3, 4000, 5000, array['2014','2015'],
   '{"calendrier_a_valider": true, "lieu_a_valider": true}'::jsonb)
on conflict (slug) do nothing;
