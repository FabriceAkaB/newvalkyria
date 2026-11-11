-- Structure de l'Académie et recrutement (Mandalart P8.2.05, P8.2.06, P8.3.06 ; automatisation AU23).
-- Les éducateurs viennent des fiches entraîneurs (coaches, coach_certifications) et des contrats
-- (employee_contracts) : rien n'est recopié. staff_members garde les autres personnes (direction,
-- consultants, caméra, comptable, postes à venir) et, au besoin, le complément d'une fiche entraîneur
-- (statut d'emploi, jours sur le terrain) grâce à coach_id, sans toucher à coaches.
-- Toutes les tables ont club_id (système duplicable). Aucune donnée d'enfant ici (Loi 25).

create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  full_name text not null,
  role text not null,
  team text not null default 'soutien' check (team in ('direction', 'terrain', 'soutien', 'a_venir')),
  employment text check (employment in ('temps_plein', 'temps_partiel', 'sur_appel', 'benevole', 'consultant')),
  email text,
  phone text,
  diplomas text,
  -- Certifications des personnes sans fiche entraîneur : [{ "name": "...", "issued_on": "AAAA-MM-JJ", "expires_on": "AAAA-MM-JJ" }]
  certifications jsonb not null default '[]'::jsonb,
  started_on date,
  notes text,
  coach_id uuid references public.coaches(id) on delete set null,
  on_field boolean not null default false,
  available_days text[] not null default '{}',
  hourly_rate_cents integer check (hourly_rate_cents is null or hourly_rate_cents >= 0),
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists staff_members_coach_uidx on public.staff_members (club_id, coach_id) where coach_id is not null;
create index if not exists staff_members_club_idx on public.staff_members (club_id, active, sort_order);

-- Postes à combler (plan de recrutement de la saison), éditables par JP
create table if not exists public.recruitment_needs (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  position text not null,
  employment text not null default 'temps_partiel' check (employment in ('temps_plein', 'temps_partiel', 'sur_appel', 'benevole', 'consultant')),
  headcount integer not null default 1 check (headcount between 1 and 50),
  due_on date,
  status text not null default 'a_ouvrir' check (status in ('a_ouvrir', 'affiche', 'entrevues', 'comble', 'annule')),
  season text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists recruitment_needs_club_idx on public.recruitment_needs (club_id, status, due_on);

-- Suivi de chaque recrutement, étape par étape
create table if not exists public.recruitment_candidates (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  need_id uuid references public.recruitment_needs(id) on delete set null,
  position text not null,
  full_name text not null,
  email text,
  phone text,
  stage text not null default 'candidat' check (stage in ('annonce', 'candidat', 'entrevue', 'antecedents', 'formation', 'contrat', 'refuse')),
  -- Date d'entrée dans chaque étape : { "entrevue": "AAAA-MM-JJ", ... }
  stage_dates jsonb not null default '{}'::jsonb,
  interview_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists recruitment_candidates_club_idx on public.recruitment_candidates (club_id, stage);

alter table public.staff_members enable row level security;
alter table public.recruitment_needs enable row level security;
alter table public.recruitment_candidates enable row level security;

do $$
declare t text;
begin
  foreach t in array array['staff_members', 'recruitment_needs', 'recruitment_candidates'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = t || '_service_role_all') then
      execute format('create policy %I on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', t || '_service_role_all', t);
    end if;
  end loop;
end $$;

-- Direction de New Valkyria (une seule fois ; JP complète ensuite les fiches dans /admin/structure)
insert into public.staff_members (club_id, full_name, role, team, employment, on_field, sort_order)
select 'new-valkyria', 'Jean-Paul Aka Boidi (JP)', 'Fondateur et entraîneur-chef', 'direction', 'temps_plein', true, 1
where not exists (select 1 from public.staff_members where club_id = 'new-valkyria' and sort_order = 1 and team = 'direction');

insert into public.staff_members (club_id, full_name, role, team, email, on_field, sort_order)
select 'new-valkyria', 'Annie Tremblay', 'Responsable administratif', 'direction', 'info@newvalkyria.com', false, 2
where not exists (select 1 from public.staff_members where club_id = 'new-valkyria' and lower(full_name) = 'annie tremblay');

insert into public.staff_members (club_id, full_name, role, team, email, on_field, sort_order)
select 'new-valkyria', 'Christine Durand', 'Gérante', 'direction', 'Christinedurand.2@hotmail.com', false, 3
where not exists (select 1 from public.staff_members where club_id = 'new-valkyria' and lower(full_name) = 'christine durand');
