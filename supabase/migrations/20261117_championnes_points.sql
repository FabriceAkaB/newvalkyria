-- Championnes du jour et points à dépenser (JP, 17 nov. 2026).
-- L'éducateur publie les championnes d'une pratique (une gagnante, un groupe, l'attitude ou une partie spéciale),
-- avec une photo si toutes les filles ont l'autorisation photo ; les points se donnent tout seuls selon le barème
-- (app_settings « points_bareme »). Les familles voient ces publications dans leur espace (fil d'actualité).
-- Les points se dépensent (cadeau, rabais boutique, crédit sur la prochaine saison) avant la fin de la saison ;
-- sinon le solde devient un cadeau par défaut (ligne « expiration »).

create table if not exists public.champion_posts (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  activity_id uuid not null references public.coach_activities(id) on delete cascade,
  kind text not null check (kind in ('individuel', 'groupe', 'attitude', 'special')),
  title text,
  points integer not null check (points >= 0),
  photo_path text,
  coach_id uuid references public.coaches(id) on delete set null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists champion_posts_activity_idx on public.champion_posts (activity_id);
create index if not exists champion_posts_created_idx on public.champion_posts (club_id, created_at desc);
alter table public.champion_posts enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'champion_posts' and policyname = 'service_role_all') then
    create policy service_role_all on public.champion_posts for all to service_role using (true) with check (true);
  end if;
end $$;

-- Lignes de points : une par championne d'une publication ; dépenses avec un statut ; expiration de fin de saison.
alter table public.player_points add column if not exists post_id uuid references public.champion_posts(id) on delete cascade;
alter table public.player_points add column if not exists status text;
alter table public.player_points add column if not exists delivered_at timestamptz;
alter table public.player_points drop constraint if exists player_points_kind_check;
alter table public.player_points add constraint player_points_kind_check check (kind in ('victoire', 'attitude', 'bonus', 'echange', 'expiration'));
alter table public.player_points drop constraint if exists player_points_status_check;
alter table public.player_points add constraint player_points_status_check check (status is null or status in ('demandee', 'remise', 'annulee'));
drop index if exists public.player_points_one_per_activity_kind;
create unique index if not exists player_points_one_per_post on public.player_points (post_id, registration_id) where post_id is not null;
create unique index if not exists player_points_one_expiration on public.player_points (registration_id) where kind = 'expiration';

-- Récompenses : un cadeau, un rabais en boutique ou un crédit sur la prochaine saison ; une est le cadeau par défaut.
alter table public.point_rewards add column if not exists kind text not null default 'cadeau';
alter table public.point_rewards drop constraint if exists point_rewards_kind_check;
alter table public.point_rewards add constraint point_rewards_kind_check check (kind in ('cadeau', 'rabais-boutique', 'credit-saison'));
alter table public.point_rewards add column if not exists value_cents integer;
alter table public.point_rewards add column if not exists description text;
alter table public.point_rewards add column if not exists is_default boolean not null default false;

-- Photos des championnes : stockage privé (liens signés seulement).
insert into storage.buckets (id, name, public)
values ('champions', 'champions', false)
on conflict (id) do nothing;

-- Fin de saison : la date où les points restants deviennent le cadeau par défaut (seasons.ends_on fait foi).
update public.seasons set starts_on = '2026-09-01', ends_on = '2027-04-18' where id in ('automne-hiver-2026', 'demo') and ends_on is null;
