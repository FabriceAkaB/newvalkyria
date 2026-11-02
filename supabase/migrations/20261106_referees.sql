-- Arbitres : liste des arbitres (lien personnel), postes d'arbitre ouverts sur nos matchs (plages de
-- match_slots), réservation par l'arbitre, paiement après le match (dépense « à payer » dans Revenus),
-- et coûts par match (terrain, éducateurs) pour le bilan financier de chaque match.

create table if not exists public.referees (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  token text not null unique,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  level text,
  interac_email text,
  notes text,
  status text not null default 'actif' check (status in ('en_attente', 'actif', 'inactif')),
  created_at timestamptz not null default now(),
  unique (club_id, email)
);

create table if not exists public.referee_assignments (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  match_slot_id uuid not null references public.match_slots(id) on delete cascade,
  role text not null default 'arbitre' check (role in ('arbitre', 'centre', 'assistant')),
  fee_cents integer not null default 5000,
  status text not null default 'ouvert' check (status in ('ouvert', 'reserve', 'annule')),
  referee_id uuid references public.referees(id) on delete set null,
  reserved_at timestamptz,
  expense_id uuid,
  paid_at timestamptz,
  paid_note text,
  created_at timestamptz not null default now()
);
create index if not exists referee_assignments_slot_idx on public.referee_assignments (match_slot_id);
create index if not exists referee_assignments_referee_idx on public.referee_assignments (referee_id);

alter table public.match_slots add column if not exists referees_needed smallint not null default 2;
alter table public.match_slots add column if not exists referee_fee_cents integer not null default 5000;
-- Part du terrain pour une heure de match : contrat Terrebonne 373 $ par réservation de 2 h → 186,50 $.
alter table public.match_slots add column if not exists field_cost_cents integer not null default 18650;
-- Éducateurs présents pendant le match (estimation, modifiable).
alter table public.match_slots add column if not exists coach_cost_cents integer not null default 4000;

alter table public.referees enable row level security;
alter table public.referee_assignments enable row level security;
do $$
declare t text;
begin
  foreach t in array array['referees', 'referee_assignments'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = t || '_service_role_all') then
      execute format('create policy %I on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', t || '_service_role_all', t);
    end if;
  end loop;
end $$;
