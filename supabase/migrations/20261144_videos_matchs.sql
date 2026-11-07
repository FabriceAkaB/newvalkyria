-- Matchs filmés dans l'espace client des familles (demande de JP, 7 nov. 2026) + accord photo/vidéo enregistré.
-- 1. L'accord du formulaire d'inscription (photo ET vidéo, un seul accord) est gardé sur l'inscription puis recopié
--    sur la joueuse. players.image_consent_at = date de la RÉPONSE (oui ou non) ; null = la famille n'a pas répondu.
-- 2. Comptes parents : le courriel doit être confirmé (lien reçu par courriel) avant de voir quoi que ce soit d'un enfant.
-- 3. match_videos : une vidéo par match (Cloudflare Stream, liens signés), visible par les familles de l'équipe et des
--    joueuses présentes au match ; chaque lecture est notée (Loi 25 : qui a vu quoi).

alter table registrations add column if not exists image_consent boolean;
alter table session_program_registrations add column if not exists image_consent boolean;

create or replace function copy_image_consent_to_player() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.player_id is not null and new.image_consent is not null
     and (tg_op = 'INSERT' or new.image_consent is distinct from old.image_consent or new.player_id is distinct from old.player_id) then
    update players set image_consent = new.image_consent, image_consent_at = now() where id = new.player_id;
  end if;
  return new;
end $$;

drop trigger if exists registrations_image_consent on registrations;
create trigger registrations_image_consent after insert or update of image_consent, player_id on registrations
  for each row execute function copy_image_consent_to_player();
drop trigger if exists spr_image_consent on session_program_registrations;
create trigger spr_image_consent after insert or update of image_consent, player_id on session_program_registrations
  for each row execute function copy_image_consent_to_player();

create table if not exists parent_email_checks (
  token text primary key,
  user_id uuid not null,
  email text not null,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);
create index if not exists parent_email_checks_user on parent_email_checks (user_id);
alter table parent_email_checks enable row level security;
drop policy if exists "service_role parent_email_checks" on parent_email_checks;
create policy "service_role parent_email_checks" on parent_email_checks for all to service_role using (true) with check (true);

create table if not exists match_videos (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  team_id uuid references mcs_teams(id) on delete set null,
  mcs_event_id bigint,
  match_date date not null,
  title text not null,
  opponent text,
  source text not null default 'fichier' check (source in ('veo', 'fichier', 'lien')),
  source_url text,
  stream_uid text unique,
  status text not null default 'importation' check (status in ('importation', 'traitement', 'pret', 'erreur')),
  duration_s integer,
  error text,
  published boolean not null default false,
  published_at timestamptz,
  consent_checked boolean not null default false,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists match_videos_team on match_videos (team_id, match_date);
alter table match_videos enable row level security;
drop policy if exists "service_role match_videos" on match_videos;
create policy "service_role match_videos" on match_videos for all to service_role using (true) with check (true);

create table if not exists match_video_views (
  id bigserial primary key,
  video_id uuid not null references match_videos(id) on delete cascade,
  parent_user_id uuid not null,
  player_id uuid,
  viewed_at timestamptz not null default now()
);
create index if not exists match_video_views_video on match_video_views (video_id);
alter table match_video_views enable row level security;
drop policy if exists "service_role match_video_views" on match_video_views;
create policy "service_role match_video_views" on match_video_views for all to service_role using (true) with check (true);

-- Joueuses présentes au match (clé de nom, lue dans les présences MonClubSportif) : une joueuse invitée d'une autre
-- équipe voit aussi le match auquel elle a participé.
alter table match_videos add column if not exists participant_keys text[] not null default '{}';

-- Pratiques filmées (demande de JP, 7 nov.) : même système, vues seulement par les éducateurs assignés à la pratique
-- (portail des éducateurs, page de l'activité), jamais par les familles.
alter table match_videos add column if not exists kind text not null default 'match';
alter table match_videos drop constraint if exists match_videos_kind_check;
alter table match_videos add constraint match_videos_kind_check check (kind in ('match', 'pratique'));
alter table match_videos add column if not exists activity_id uuid references coach_activities(id) on delete set null;
create index if not exists match_videos_activity on match_videos (activity_id);
