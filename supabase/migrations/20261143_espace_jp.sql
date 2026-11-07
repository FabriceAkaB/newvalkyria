-- Espace JP (6 nov. 2026) : JP se gère comme une ressource à part entière. Ses habitudes (sommeil compris), sa
-- nutrition et les connaissances qu'il accumule. Son calendrier est lu depuis Google Agenda (adresse iCal secrète
-- dans app_settings, clé « jp_calendar_ical ») ; ses tâches sont dans team_tasks. Données de JP seulement.

create table if not exists public.jp_habits (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  name text not null,
  kind text not null default 'check' check (kind in ('check', 'nombre')),
  unit text,
  -- check : jours par semaine visés ; nombre : valeur visée chaque jour (ex. 7,5 h de sommeil)
  target numeric not null default 7,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.jp_habit_logs (
  habit_id uuid not null references public.jp_habits(id) on delete cascade,
  day date not null,
  value numeric not null default 1,
  note text,
  updated_at timestamptz not null default now(),
  primary key (habit_id, day)
);

create table if not exists public.jp_meals (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  day date not null,
  moment text not null check (moment in ('dejeuner', 'diner', 'souper', 'collation', 'avant-match', 'eau')),
  description text not null default '',
  protein_g integer,
  quality text check (quality in ('bien', 'moyen', 'a-ameliorer')),
  created_at timestamptz not null default now()
);
create index if not exists jp_meals_day_idx on public.jp_meals (club_id, day desc);

create table if not exists public.jp_knowledge (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  title text not null,
  source_type text not null default 'livre' check (source_type in ('livre', 'video', 'cours', 'balado', 'mentor', 'article', 'experience')),
  author text,
  url text,
  status text not null default 'a-lire' check (status in ('a-lire', 'en-cours', 'fini')),
  lessons text,
  apply_to text,
  tags text[] not null default '{}',
  applied boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['jp_habits', 'jp_habit_logs', 'jp_meals', 'jp_knowledge'] loop
    execute format('alter table public.%I enable row level security', t);
    begin
      execute format('create policy %I on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', t || '_service_role_all', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- Habitudes de départ (JP les change dans l'onglet Mes habitudes)
insert into public.jp_habits (name, kind, unit, target, sort_order)
select * from (values
  ('Sommeil', 'nombre', 'heures', 7.5, 1),
  ('Coucher avant 23 h', 'check', null, 6, 2),
  ('Entraînement physique', 'check', null, 4, 3),
  ('Lecture ou formation (20 min)', 'check', null, 5, 4),
  ('Bloc de travail profond (2 h, sans téléphone)', 'check', null, 4, 5),
  ('Contenu publié (image personnelle)', 'check', null, 3, 6),
  ('Eau (verres)', 'nombre', 'verres', 8, 7)
) as v(name, kind, unit, target, sort_order)
where not exists (select 1 from public.jp_habits);
