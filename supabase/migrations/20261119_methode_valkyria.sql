-- Méthode Valkyria écrite (Mandalart P1.1.01 à P1.1.05, P1.4.05, P1.5.01, P1.6) : structure de séance, principes
-- et bibliothèque des gestes. Rien d'existant ne garde ce contenu (la banque d'exercices décrit des exercices, pas
-- des gestes ni la méthode).

-- Textes de la méthode (structure de séance, principes) : un document par sujet, contenu structuré en jsonb.
create table if not exists public.coaching_method_docs (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  slug text not null,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  validated_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (club_id, slug)
);

alter table public.coaching_method_docs enable row level security;
drop policy if exists "service_role_all" on public.coaching_method_docs;
create policy "service_role_all" on public.coaching_method_docs
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Bibliothèque des gestes : famille, niveau du passeport, fiche et progression en 4 étapes.
create table if not exists public.method_gestures (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  name text not null,
  family text not null,                        -- semelle, interieur-exterieur, changements-direction, feintes, controles-orientes
  passport_level text check (passport_level in ('bronze', 'argent', 'or', 'mauve')),
  execution text,
  key_points text[] not null default '{}',     -- 3 points clés
  common_mistakes text,
  video_url text,                              -- démonstration (YouTube non répertorié)
  progression jsonb not null default '{}'::jsonb, -- { "sur-place": "", "en-mouvement": "", "a-vitesse": "", "sous-pression": "" }
  sort_order integer not null default 0,
  active boolean not null default true,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists method_gestures_family_idx on public.method_gestures (club_id, family, sort_order);

alter table public.method_gestures enable row level security;
drop policy if exists "service_role_all" on public.method_gestures;
create policy "service_role_all" on public.method_gestures
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
