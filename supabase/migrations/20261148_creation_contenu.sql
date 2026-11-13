-- Espace « Création de contenu » (13 nov. 2026). Réutilise jp_video_shoots (tournages) et marketing_posts
-- (publications et chiffres) ; ajoute ce qui manquait :
--   * le calendrier de publication sur les tournages (date de publication, organique / essai / pub, angle, réseaux, qui filme) ;
--   * le suivi du ball mastery filmé à 360° à chaque pratique (content_captures) ;
--   * le projet entrevues avant/après (P8.1, P3.2.07, P3.2.08) : journées d'entrevues et invitations aux familles
--     avec un lien personnel pour choisir l'heure (content_interview_slots, content_interviews).

alter table public.jp_video_shoots add column if not exists publish_on date;
alter table public.jp_video_shoots add column if not exists post_kind text not null default 'organique';
alter table public.jp_video_shoots add column if not exists angle text;
alter table public.jp_video_shoots add column if not exists networks text[] not null default '{}';
alter table public.jp_video_shoots add column if not exists filmed_by text;
create index if not exists jp_video_shoots_publish_idx on public.jp_video_shoots (club_id, publish_on);

create table if not exists public.content_captures (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  activity_id uuid not null references public.coach_activities(id) on delete cascade,
  kind text not null default 'ball_mastery_360',
  filmed_by text,
  url text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id, kind)
);

create table if not exists public.content_interview_slots (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  day date not null,
  start_time text not null,
  end_time text not null,
  place text not null,
  capacity integer not null default 4,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists content_interview_slots_day_idx on public.content_interview_slots (club_id, day);

create table if not exists public.content_interviews (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  token text not null unique,
  registration_id uuid,
  player_name text not null,
  parent_name text,
  parent_email text,
  kind text not null default 'debut' check (kind in ('debut', 'fin')),
  with_parent boolean not null default true,
  slot_id uuid references public.content_interview_slots(id) on delete set null,
  status text not null default 'a_inviter' check (status in ('a_inviter', 'invitee', 'confirmee', 'filmee', 'montee', 'publiee', 'decline')),
  invited_at timestamptz,
  confirmed_at timestamptz,
  filmed_at timestamptz,
  video_url text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists content_interviews_status_idx on public.content_interviews (club_id, status);

do $$
declare t text;
begin
  foreach t in array array['content_captures', 'content_interview_slots', 'content_interviews'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where tablename = t and policyname = t || '_service_role_all') then
      execute format('create policy %I on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', t || '_service_role_all', t);
    end if;
  end loop;
end $$;
