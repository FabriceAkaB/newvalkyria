-- ════════════════════════════════════════════════════════════════
-- Fondation multi-saisons — Phase 1
-- ----------------------------------------------------------------
-- Ajoute uniquement de nouvelles tables. Ne modifie ni ne touche
-- en aucune façon les tables existantes (leads, capacity_config,
-- stripe_events, slot_configs) qui continuent de piloter la
-- Saison Été 2026 exactement comme avant.
--
-- "taken" (places occupées) n'est jamais stocké : il se calcule en
-- direct par comptage des inscriptions réelles. Seul "max_places"
-- (la capacité) est une valeur éditable stockée.
-- ════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── 1. Saisons ────────────────────────────────────────────────
create table if not exists public.seasons (
  id          text primary key,
  label       text not null,
  starts_on   date,
  ends_on     date,
  is_active   boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.seasons enable row level security;
drop policy if exists "service role can manage seasons" on public.seasons;
create policy "service role can manage seasons"
  on public.seasons for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ── 2. Catégories d'âge (par saison) ─────────────────────────────
create table if not exists public.birth_categories (
  season_id      text not null references public.seasons(id) on delete cascade,
  id             text not null,
  label          text not null,
  display_order  integer not null default 0,
  primary key (season_id, id)
);

alter table public.birth_categories enable row level security;
drop policy if exists "service role can manage birth_categories" on public.birth_categories;
create policy "service role can manage birth_categories"
  on public.birth_categories for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ── 3. Programmes (par saison) ───────────────────────────────────
create table if not exists public.programs (
  season_id      text not null references public.seasons(id) on delete cascade,
  id             text not null,
  name           text not null,
  price_cents    integer not null,
  invitation     boolean not null default false,
  tagline        text,
  includes       jsonb not null default '[]',
  tech_count     text,
  team_count     text,
  solo_count     text,
  badge          text,
  display_order  integer not null default 0,
  active         boolean not null default true,
  primary key (season_id, id)
);

alter table public.programs enable row level security;
drop policy if exists "service role can manage programs" on public.programs;
create policy "service role can manage programs"
  on public.programs for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ── 4. Capacité par programme × catégorie ────────────────────────
create table if not exists public.program_categories (
  season_id    text not null,
  program_id   text not null,
  category_id  text not null,
  max_places   integer not null default 0,
  primary key (season_id, program_id, category_id),
  foreign key (season_id, program_id) references public.programs(season_id, id) on delete cascade,
  foreign key (season_id, category_id) references public.birth_categories(season_id, id) on delete cascade
);

alter table public.program_categories enable row level security;
drop policy if exists "service role can manage program_categories" on public.program_categories;
create policy "service role can manage program_categories"
  on public.program_categories for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ── 5. Plages horaires récurrentes (gabarit hebdomadaire) ────────
create table if not exists public.time_slot_templates (
  id                        uuid primary key default gen_random_uuid(),
  season_id                 text not null references public.seasons(id) on delete cascade,
  day                       text not null,
  start_time                text not null,
  end_time                  text not null,
  location                  text not null,
  max_places                integer not null default 0,
  recommended_for_advanced  boolean not null default false,
  advanced_only             boolean not null default false,
  active                    boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists time_slot_templates_season_idx on public.time_slot_templates (season_id);

alter table public.time_slot_templates enable row level security;
drop policy if exists "service role can manage time_slot_templates" on public.time_slot_templates;
create policy "service role can manage time_slot_templates"
  on public.time_slot_templates for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ── 6. Catégories desservies par une plage ───────────────────────
create table if not exists public.time_slot_template_categories (
  time_slot_template_id  uuid not null references public.time_slot_templates(id) on delete cascade,
  category_id            text not null,
  primary key (time_slot_template_id, category_id)
);

alter table public.time_slot_template_categories enable row level security;
drop policy if exists "service role can manage time_slot_template_categories" on public.time_slot_template_categories;
create policy "service role can manage time_slot_template_categories"
  on public.time_slot_template_categories for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ── 7. Programmes desservis par une plage ────────────────────────
create table if not exists public.time_slot_template_programs (
  time_slot_template_id  uuid not null references public.time_slot_templates(id) on delete cascade,
  program_id             text not null,
  primary key (time_slot_template_id, program_id)
);

alter table public.time_slot_template_programs enable row level security;
drop policy if exists "service role can manage time_slot_template_programs" on public.time_slot_template_programs;
create policy "service role can manage time_slot_template_programs"
  on public.time_slot_template_programs for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ── 8. Dates réelles du calendrier (pour export TeamLink) ────────
create table if not exists public.time_slot_dates (
  id                      uuid primary key default gen_random_uuid(),
  time_slot_template_id   uuid not null references public.time_slot_templates(id) on delete cascade,
  occurs_on               date not null,
  cancelled               boolean not null default false,
  note                    text,
  unique (time_slot_template_id, occurs_on)
);

create index if not exists time_slot_dates_occurs_on_idx on public.time_slot_dates (occurs_on);

alter table public.time_slot_dates enable row level security;
drop policy if exists "service role can manage time_slot_dates" on public.time_slot_dates;
create policy "service role can manage time_slot_dates"
  on public.time_slot_dates for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ── 9. Inscriptions (nouvelle table, indépendante de "leads") ────
create table if not exists public.registrations (
  id                          uuid primary key default gen_random_uuid(),
  season_id                   text not null references public.seasons(id) on delete cascade,
  program_id                  text,
  category_id                 text,
  time_slot_template_id       uuid references public.time_slot_templates(id),
  parent_name                 text not null,
  parent_email                text not null,
  parent_phone                text not null,
  city                        text,
  player_first_name           text,
  player_last_name            text,
  player_dob                  date,
  status                      text not null default 'pending',
  is_trial                    boolean not null default false,
  trial_date                  date,
  is_half_season              boolean not null default false,
  half_season_ends_on         date,
  advanced_group              boolean not null default false,
  converted_from_id           uuid references public.registrations(id),
  stripe_checkout_session_id  text,
  stripe_payment_intent_id    text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index if not exists registrations_season_status_idx on public.registrations (season_id, status);
create index if not exists registrations_trial_idx on public.registrations (season_id, is_trial);
create index if not exists registrations_slot_idx on public.registrations (time_slot_template_id);
create index if not exists registrations_half_season_idx on public.registrations (is_half_season, half_season_ends_on);

alter table public.registrations enable row level security;
drop policy if exists "service role can manage registrations" on public.registrations;
create policy "service role can manage registrations"
  on public.registrations for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');


-- ════════════════════════════════════════════════════════════════
-- Données de départ (seed)
-- ----------------------------------------------------------------
-- "ete-2026" = simple repère d'identité pour le futur sélecteur de
-- saison. Le système Été 2026 continue de fonctionner exactement
-- comme avant, sur ses tables actuelles (leads, capacity_config,
-- slot_configs) — cette ligne ne fait que le nommer dans la liste
-- des saisons, sans dupliquer ni migrer ses données.
--
-- "automne-hiver-2026" migre les valeurs réelles actuellement
-- codées en dur dans src/lib/season-2027.ts (prix, capacités
-- maximales, plages horaires). Les compteurs "taken" ne sont PAS
-- copiés : ils repartent à zéro et se calculeront en direct à
-- partir des vraies inscriptions à venir.
-- ════════════════════════════════════════════════════════════════

insert into public.seasons (id, label, is_active) values
  ('ete-2026', 'Saison Été 2026', true),
  ('automne-hiver-2026', 'Saison Automne / Hiver 2026', false)
on conflict (id) do nothing;

insert into public.birth_categories (season_id, id, label, display_order) values
  ('automne-hiver-2026', '2017', '2017', 1),
  ('automne-hiver-2026', '2016', '2016', 2),
  ('automne-hiver-2026', '2015', '2015', 3),
  ('automne-hiver-2026', '2014-2013', '2014–2013', 4)
on conflict (season_id, id) do nothing;

insert into public.programs (season_id, id, name, price_cents, invitation, tagline, includes, tech_count, team_count, solo_count, badge, display_order) values
  ('automne-hiver-2026', 'TV', 'Team Valkyria', 87595, false,
   'L''offre principale — technique, équipe et vie d''académie.',
   '["20 pratiques techniques semi-privé","10 pratiques d''équipe (une aux deux semaines)","Environ 30 activités durant la saison","Accès au programme vidéo maison","Bulletin de suivi des apprentissages"]',
   '20', '10', '—', '🔥 Le plus populaire', 1),
  ('automne-hiver-2026', 'SV', 'Solo Valkyria', 145495, false,
   'Développement accéléré avec séances individuelles.',
   '["15 pratiques techniques semi-privé","10 pratiques d''équipe","5 séances individuelles (One-on-One)","Accès au programme vidéo maison","Bulletin de suivi des apprentissages"]',
   '15', '10', '5', null, 2),
  ('automne-hiver-2026', 'NV', 'New Valkyria', 65345, false,
   'L''essentiel technique pour progresser.',
   '["20 pratiques techniques semi-privé","Accès au programme vidéo maison","Bulletin de suivi des apprentissages"]',
   '20', '—', '—', null, 3),
  ('automne-hiver-2026', 'TVA', 'Team Valkyria Avancé', 87595, true,
   'Sur invitation — groupe avancé.',
   '["20 pratiques techniques semi-privé","10 pratiques d''équipe (une aux deux semaines)","Environ 30 activités durant la saison","Accès au programme vidéo maison","Bulletin de suivi des apprentissages"]',
   '20', '10', '—', '🔥 Le plus populaire', 1),
  ('automne-hiver-2026', 'SVA', 'Solo Valkyria Avancé', 145495, true,
   'Sur invitation — groupe avancé, séances individuelles.',
   '["15 pratiques techniques semi-privé","10 pratiques d''équipe","5 séances individuelles (One-on-One)","Accès au programme vidéo maison","Bulletin de suivi des apprentissages"]',
   '15', '10', '5', null, 2)
on conflict (season_id, id) do nothing;

insert into public.program_categories (season_id, program_id, category_id, max_places) values
  ('automne-hiver-2026', 'TV', '2017', 16),
  ('automne-hiver-2026', 'TV', '2016', 24),
  ('automne-hiver-2026', 'TV', '2015', 24),
  ('automne-hiver-2026', 'TV', '2014-2013', 16),
  ('automne-hiver-2026', 'SV', '2017', 8),
  ('automne-hiver-2026', 'SV', '2016', 8),
  ('automne-hiver-2026', 'SV', '2015', 8),
  ('automne-hiver-2026', 'SV', '2014-2013', 8),
  ('automne-hiver-2026', 'NV', '2017', 16),
  ('automne-hiver-2026', 'NV', '2016', 24),
  ('automne-hiver-2026', 'NV', '2015', 24),
  ('automne-hiver-2026', 'NV', '2014-2013', 16),
  ('automne-hiver-2026', 'TVA', '2016', 12),
  ('automne-hiver-2026', 'TVA', '2015', 12),
  ('automne-hiver-2026', 'SVA', '2016', 4),
  ('automne-hiver-2026', 'SVA', '2015', 4)
on conflict (season_id, program_id, category_id) do nothing;

-- Plages horaires — bloc PL/pgSQL avec boucle sur une table de
-- valeurs, pour insérer chaque plage puis relier catégories et
-- programmes dans les tables de jonction. Portable (aucune
-- méta-commande psql, aucune fonction/procédure permanente créée).
do $$
declare
  rec record;
  v_slot_id uuid;
  v_cat text;
  v_prog text;
begin
  -- Ne réensemence pas si les plages 2026 existent déjà (migration relançable).
  if exists (select 1 from public.time_slot_templates where season_id = 'automne-hiver-2026') then
    return;
  end if;

  for rec in
    select * from (values
      -- day, start, end, location, max_places, recommended_for_advanced, advanced_only, categories, programs
      ('Lundi',    '18:00', '19:25', 'Sainte-Thérèse', 8,  true,  true,  array['2016'],      array['TVA','SVA']),
      ('Lundi',    '18:00', '19:25', 'Sainte-Thérèse', 8,  false, false, array['2017'],      array['TV','SV','NV']),
      ('Lundi',    '19:30', '20:55', 'Sainte-Thérèse', 8,  false, false, array['2015'],      array['TV','SV','NV','TVA','SVA']),
      ('Lundi',    '19:30', '20:55', 'Sainte-Thérèse', 8,  false, false, array['2014-2013'], array['TV','SV','NV']),
      ('Mercredi', '18:00', '19:25', 'Sainte-Thérèse', 12, true,  true,  array['2015'],      array['TVA','SVA']),
      ('Mercredi', '18:00', '19:25', 'Sainte-Thérèse', 4,  false, false, array['2015'],      array['TV','SV','NV']),
      ('Jeudi',    '18:00', '19:25', 'Saint-Jérôme',   8,  false, false, array['2016'],      array['TV','SV','NV','TVA','SVA']),
      ('Jeudi',    '18:00', '19:25', 'Saint-Jérôme',   8,  false, false, array['2017'],      array['TV','SV','NV']),
      ('Jeudi',    '19:30', '20:55', 'Saint-Jérôme',   8,  false, false, array['2015'],      array['TV','SV','NV','TVA','SVA']),
      ('Jeudi',    '19:30', '20:55', 'Saint-Jérôme',   8,  false, false, array['2014-2013'], array['TV','SV','NV']),
      ('Vendredi', '18:00', '19:25', 'Sainte-Thérèse', 8,  false, false, array['2016'],      array['TV','SV','NV','TVA','SVA']),
      ('Vendredi', '18:00', '19:25', 'Sainte-Thérèse', 8,  false, false, array['2017'],      array['TV','SV','NV'])
    ) as t(day, start_time, end_time, location, max_places, recommended_for_advanced, advanced_only, categories, programs)
  loop
    insert into public.time_slot_templates
      (season_id, day, start_time, end_time, location, max_places, recommended_for_advanced, advanced_only)
    values
      ('automne-hiver-2026', rec.day, rec.start_time, rec.end_time, rec.location, rec.max_places, rec.recommended_for_advanced, rec.advanced_only)
    returning id into v_slot_id;

    foreach v_cat in array rec.categories loop
      insert into public.time_slot_template_categories (time_slot_template_id, category_id)
      values (v_slot_id, v_cat)
      on conflict do nothing;
    end loop;

    foreach v_prog in array rec.programs loop
      insert into public.time_slot_template_programs (time_slot_template_id, program_id)
      values (v_slot_id, v_prog)
      on conflict do nothing;
    end loop;
  end loop;
end $$;
