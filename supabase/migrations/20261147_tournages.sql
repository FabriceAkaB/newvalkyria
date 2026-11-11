-- Tournages de JP (11 nov. 2026) : chaque vidéo se planifie la veille (accroche, message, plans, lieu, qui,
-- matériel), passe par « tourné », « monté », puis « publié » ; la publication et ses chiffres vivent ensuite
-- dans marketing_posts (post_group_id). Les 5 séries de vidéos explicatives du Mandalart (P3.2.12 à P3.2.17,
-- P4.1.06) y sont préremplies comme idées.

create table if not exists public.jp_video_shoots (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  title text not null,
  series text not null default 'reseaux',
  status text not null default 'idee' check (status in ('idee', 'planifie', 'tourne', 'monte', 'publie')),
  shoot_on date,
  shoot_time text,
  place text,
  message text,
  hook text,
  shots text,
  people text,
  gear text,
  format text,
  mandalart_code text,
  post_group_id uuid,
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jp_video_shoots_day_idx on public.jp_video_shoots (club_id, shoot_on);

do $$
begin
  execute 'alter table public.jp_video_shoots enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'jp_video_shoots' and policyname = 'jp_video_shoots_service_role_all') then
    execute 'create policy jp_video_shoots_service_role_all on public.jp_video_shoots for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')';
  end if;
end $$;
