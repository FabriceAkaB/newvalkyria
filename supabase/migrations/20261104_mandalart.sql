-- Mandalart (plan 1,5 M$ en 2028) : le PLAN vit dans data/mandalart.json (versionné) ;
-- ces tables ne gardent que l'ÉTAT (cases cochées, valeurs d'indicateurs, journal).
-- Toutes les tables ont une colonne club_id : le même système peut servir à un autre club
-- (Valkyria Club System) sans migration. Aucune donnée d'enfant ici (Loi 25).

create table if not exists public.mandalart_tasks_state (
  club_id text not null default 'new-valkyria',
  code text not null,
  status text not null default 'a_faire' check (status in ('a_faire', 'en_cours', 'fait', 'abandonne')),
  owner text,
  due date,
  note text,
  evidence_url text,
  done_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (club_id, code)
);

-- Tâches ajoutées par JP dans l'admin (code du type P1.3.X01)
create table if not exists public.mandalart_tasks_custom (
  club_id text not null default 'new-valkyria',
  code text not null,
  objective text not null,
  title text not null,
  level smallint not null check (level between 1 and 6),
  priority text not null check (priority in ('star', 'progressive')),
  due date,
  owner text,
  created_at timestamptz not null default now(),
  primary key (club_id, code)
);

-- Journal : « ce qui se trame »
create table if not exists public.mandalart_events (
  id bigserial primary key,
  club_id text not null default 'new-valkyria',
  code text not null,
  from_status text,
  to_status text,
  note text,
  at timestamptz not null default now(),
  by text
);
create index if not exists mandalart_events_club_at_idx on public.mandalart_events (club_id, at desc);

-- Valeurs saisies à la main et instantanés automatiques des indicateurs
create table if not exists public.mandalart_kpi_values (
  id bigserial primary key,
  club_id text not null default 'new-valkyria',
  kpi_id text not null,
  value numeric not null,
  measured_at date not null default current_date,
  source text not null default 'manuel' check (source in ('auto', 'manuel')),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists mandalart_kpi_values_idx on public.mandalart_kpi_values (club_id, kpi_id, measured_at desc);

-- Historique hebdomadaire (instantané du lundi) pour les courbes
create table if not exists public.mandalart_snapshots (
  club_id text not null default 'new-valkyria',
  week date not null,
  execution numeric,
  results numeric,
  level smallint,
  pillars jsonb,
  kpis jsonb,
  created_at timestamptz not null default now(),
  primary key (club_id, week)
);

-- État des agents IA (A01…) et des automatisations (AU01…) : à créer, en construction, actif, en pause
create table if not exists public.mandalart_agent_state (
  club_id text not null default 'new-valkyria',
  item_id text not null,
  status text not null default 'a_creer' check (status in ('a_creer', 'en_construction', 'actif', 'pause')),
  mode text check (mode in ('assistant', 'semi-automatique', 'autonome')),
  hours_saved_week numeric,
  note text,
  updated_at timestamptz not null default now(),
  primary key (club_id, item_id)
);

-- Statistiques des réseaux et de la publicité (saisie manuelle ; plus tard, l'agent statistiques A06)
create table if not exists public.marketing_channel_stats (
  id bigserial primary key,
  club_id text not null default 'new-valkyria',
  channel text not null check (channel in ('instagram', 'facebook', 'youtube', 'tiktok', 'pub_meta', 'pub_google', 'autre')),
  measured_at date not null default current_date,
  followers integer,
  posts integer,
  views integer,
  spend_cents integer,
  leads integer,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists marketing_channel_stats_idx on public.marketing_channel_stats (club_id, channel, measured_at desc);

alter table public.mandalart_tasks_state enable row level security;
alter table public.mandalart_tasks_custom enable row level security;
alter table public.mandalart_events enable row level security;
alter table public.mandalart_kpi_values enable row level security;
alter table public.mandalart_snapshots enable row level security;
alter table public.mandalart_agent_state enable row level security;
alter table public.marketing_channel_stats enable row level security;

do $$
declare t text;
begin
  foreach t in array array['mandalart_tasks_state', 'mandalart_tasks_custom', 'mandalart_events', 'mandalart_kpi_values', 'mandalart_snapshots', 'mandalart_agent_state', 'marketing_channel_stats'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = t || '_service_role_all') then
      execute format('create policy %I on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', t || '_service_role_all', t);
    end if;
  end loop;
end $$;
