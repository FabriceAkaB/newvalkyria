-- Dates d'essai gratuit sélectionnables publiquement, avec capacité réelle
-- par date (5 places/jour, section demandée pour septembre 2026). Aucun
-- système existant ne gérait une capacité par date ponctuelle pour les
-- essais (audit du 2 sept 2026) — table neuve, patron inspiré de
-- time_slot_templates (capacité comptée en direct, jamais stockée).
create table public.trial_slots (
  id uuid primary key default gen_random_uuid(),
  slot_date date not null,
  start_time text not null,
  end_time text not null,
  location text not null,
  max_places integer not null default 5,
  -- Années de naissance admissibles (ex. {'2016','2017'}).
  eligible_birth_years text[] not null,
  -- Niveaux admissibles (ex. {'D1'}) — null = tous niveaux.
  eligible_levels text[],
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.trial_slots enable row level security;
create policy trial_slots_service_role_all on public.trial_slots
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

alter table public.registrations add column if not exists trial_slot_id uuid references public.trial_slots(id);
create index if not exists idx_registrations_trial_slot on public.registrations(trial_slot_id);

-- ── Dates de septembre 2026 ──────────────────────────────────────
insert into public.trial_slots (slot_date, start_time, end_time, location, max_places, eligible_birth_years, eligible_levels) values
  ('2026-09-15', '18:00', '19:30', 'École Hubert-Maisonneuve, Rosemère', 5, array['2016','2017'], array['D1']),
  ('2026-09-22', '18:00', '19:30', 'École Hubert-Maisonneuve, Rosemère', 5, array['2016','2017'], array['D1']),
  ('2026-09-17', '18:00', '19:30', 'École Hubert-Maisonneuve, Rosemère', 5, array['2016','2017'], array['Débutante','D3','D2']),
  ('2026-09-24', '18:00', '19:30', 'École Hubert-Maisonneuve, Rosemère', 5, array['2016','2017'], array['Débutante','D3','D2']),
  ('2026-09-14', '18:00', '19:30', 'Centre Multisport de Rosemère', 5, array['2014','2015'], null),
  ('2026-09-16', '18:00', '19:30', 'Centre Multisport de Rosemère', 5, array['2014','2015'], null),
  ('2026-09-21', '18:00', '19:30', 'Centre Multisport de Rosemère', 5, array['2014','2015'], null),
  ('2026-09-23', '18:00', '19:30', 'Centre Multisport de Rosemère', 5, array['2014','2015'], null);
