-- Vidéos de progression, suite (JP, 25 nov. 2026) : toutes les vidéos d'une joueuse, peu importe la date, plusieurs
-- capsules par jour ; étape (début / mi-saison / fin) facultative ; demande de vidéos à chaque pratique de filles,
-- avec « Absente ce jour-là » gardé en base. Vidéos d'enfants : compartiment privé (Loi 25).
alter table public.player_progress_videos alter column checkpoint drop not null;
alter table public.player_progress_videos drop constraint if exists player_progress_videos_checkpoint_check;
alter table public.player_progress_videos add constraint player_progress_videos_checkpoint_check check (checkpoint is null or checkpoint in ('debut', 'mi', 'fin'));
alter table public.player_progress_videos add column if not exists filmed_on date;
alter table public.player_progress_videos add column if not exists activity_id uuid;
update public.player_progress_videos set filmed_on = (created_at at time zone 'America/Toronto')::date where filmed_on is null;
create index if not exists player_progress_videos_activity_idx on public.player_progress_videos (activity_id);
create index if not exists player_progress_videos_filmed_idx on public.player_progress_videos (filmed_on);

-- Absente (ou présente malgré MonClubSportif) pour la demande de vidéos d'une pratique.
create table if not exists public.player_progress_video_marks (
  activity_id uuid not null,
  registration_id uuid not null,
  club_id text not null default 'new-valkyria',
  status text not null check (status in ('absente', 'presente')),
  marked_by text,
  updated_at timestamptz not null default now(),
  primary key (activity_id, registration_id)
);
do $$
begin
  execute 'alter table public.player_progress_video_marks enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'player_progress_video_marks' and policyname = 'player_progress_video_marks_service_role_all') then
    execute 'create policy player_progress_video_marks_service_role_all on public.player_progress_video_marks for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')';
  end if;
end $$;
