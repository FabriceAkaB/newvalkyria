-- Plages de match vendues aux autres académies : acompte de 50 $ pour réserver,
-- solde de 200 $ payable le jour du match, détails du match (format, adversaire,
-- adresse), restrictions d'admissibilité (genre / année de naissance) et doubles cédules.
alter table public.match_slots add column if not exists balance_due_cents integer not null default 20000 check (balance_due_cents >= 0);
alter table public.match_slots add column if not exists match_format text;
alter table public.match_slots add column if not exists opponent text;
alter table public.match_slots add column if not exists allowed_gender text not null default 'tous' check (allowed_gender in ('tous', 'filles', 'garcons'));
alter table public.match_slots add column if not exists birth_year_min integer;
alter table public.match_slots add column if not exists birth_year_max integer;
alter table public.match_slots add column if not exists restriction_note text;
alter table public.match_slots add column if not exists double_group uuid;
create index if not exists idx_match_slots_double_group on public.match_slots(double_group) where double_group is not null;

-- L'acompte (price_cents) passe de 100 $ à 50 $ pour toutes les plages encore libres.
alter table public.match_slots alter column price_cents set default 5000;
update public.match_slots s set price_cents = 5000
 where price_cents = 10000
   and not exists (select 1 from public.match_slot_bookings b where b.slot_id = s.id and b.status in ('pending', 'paid'));

-- Doubles cédules existantes : deux plages qui se suivent le même jour, au même endroit.
with pairs as (
  select a.id as aid, b.id as bid, gen_random_uuid() as g
    from public.match_slots a
    join public.match_slots b on a.slot_date = b.slot_date and a.location = b.location and a.end_time = b.start_time
   where a.double_group is null and b.double_group is null
)
update public.match_slots s set double_group = p.g from pairs p where s.id in (p.aid, p.bid);

alter table public.match_slot_bookings add column if not exists balance_due_cents integer not null default 0;
alter table public.match_slot_bookings add column if not exists balance_paid_at timestamptz;
alter table public.match_slot_bookings add column if not exists team_gender text check (team_gender in ('filles', 'garcons', 'mixte'));
alter table public.match_slot_bookings add column if not exists team_birth_year integer;
