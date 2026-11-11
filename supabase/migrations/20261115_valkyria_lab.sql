-- Valkyria Lab, phase 1 (Mandalart P1.7.02, P1.7.12, automatisation AU08) :
--   * la routine maison du mois (consignes, gestes avec vidéo de démonstration, défi du mois, jeu de la semaine) ;
--   * un lien personnel par famille (créé à partir des inscriptions payées de la saison en cours) ;
--   * « Envoyer ma vidéo » : le parent téléverse directement dans un bucket PRIVÉ, le coach la regarde
--     par un lien signé de 10 minutes et laisse un court commentaire.
-- Loi 25 : les vidéos d'enfants restent dans le stockage privé 'valkyria-lab' (jamais public) ; seules les
-- tables lab_* contiennent les prénoms des joueuses. Colonne club_id partout (système duplicable).

create table if not exists public.lab_routines (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  title text not null,
  instructions text,
  -- [{ "name": "Semelle", "how": "3 x 30 s chaque pied", "videoUrl": "https://youtu.be/…" }]
  exercises jsonb not null default '[]'::jsonb,
  challenge text,
  challenge_video_url text,
  -- [{ "title": "…", "how": "…", "videoUrl": "…" }] : semaine 1, 2, 3, 4 (la dernière sert aussi à la semaine 5)
  weekly_games jsonb not null default '[]'::jsonb,
  status text not null default 'brouillon' check (status in ('brouillon', 'publie')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, month)
);

create table if not exists public.lab_access (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  token text not null unique,
  parent_email text not null,
  parent_name text,
  -- [{ "firstName": "Léa", "lastName": "Tremblay" }]
  players jsonb not null default '[]'::jsonb,
  season_id text,
  active boolean not null default true,
  sent_at timestamptz,
  send_count integer not null default 0,
  opened_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, parent_email)
);

create table if not exists public.lab_submissions (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  access_id uuid not null references public.lab_access(id) on delete cascade,
  routine_id uuid references public.lab_routines(id) on delete set null,
  player_name text not null,
  gesture text not null,
  storage_path text not null unique,
  content_type text,
  size_bytes bigint,
  recorded_on date not null default current_date,
  status text not null default 'a_voir' check (status in ('a_voir', 'vu')),
  coach_comment text,
  seen_at timestamptz,
  family_notified_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists lab_submissions_club_status_idx on public.lab_submissions (club_id, status, created_at desc);
create index if not exists lab_submissions_access_idx on public.lab_submissions (access_id, created_at desc);

alter table public.lab_routines enable row level security;
alter table public.lab_access enable row level security;
alter table public.lab_submissions enable row level security;

do $$
declare t text;
begin
  foreach t in array array['lab_routines', 'lab_access', 'lab_submissions'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = t || '_service_role_all') then
      execute format('create policy %I on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', t || '_service_role_all', t);
    end if;
  end loop;
end $$;

-- Stockage privé des vidéos : 300 Mo maximum, vidéos seulement.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('valkyria-lab', 'valkyria-lab', false, 314572800, array['video/*'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
