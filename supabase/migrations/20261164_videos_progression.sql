-- Progression en vidéo (JP, 19 nov. 2026) : chaque fille filmée au début (petites), à la mi-saison et à la fin ;
-- la famille voit les vidéos de sa fille et un avant / après. Vidéos d'enfants : compartiment privé (Loi 25).
create table if not exists public.player_progress_videos (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  season_id text,
  registration_id uuid not null,
  checkpoint text not null check (checkpoint in ('debut', 'mi', 'fin')),
  title text not null default 'Ball mastery',
  storage_path text not null,
  file_name text,
  note text,
  uploaded_by text,
  created_at timestamptz not null default now()
);
create index if not exists player_progress_videos_reg_idx on public.player_progress_videos (registration_id, checkpoint);
do $$
begin
  execute 'alter table public.player_progress_videos enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'player_progress_videos' and policyname = 'player_progress_videos_service_role_all') then
    execute 'create policy player_progress_videos_service_role_all on public.player_progress_videos for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')';
  end if;
end $$;
insert into storage.buckets (id, name, public, allowed_mime_types)
values ('progression-videos', 'progression-videos', false, array['video/*'])
on conflict (id) do nothing;
