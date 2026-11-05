-- Robot MonClubSportif (agent A12) : chaque équipe MCS connaît son numéro dans MonClubSportif et les groupes du site
-- qui y vont (plage horaire, programme + années, programme à dates fixes). Rangé par club : duplicable pour un autre club.
alter table public.mcs_teams add column if not exists mcs_team_id integer;
alter table public.mcs_teams add column if not exists mcs_season_id integer;
alter table public.mcs_teams add column if not exists kind text not null default 'pratique';
alter table public.mcs_teams add column if not exists slot_ids uuid[] not null default '{}';
alter table public.mcs_teams add column if not exists program_ids text[] not null default '{}';
alter table public.mcs_teams add column if not exists session_program_slugs text[] not null default '{}';
do $$ begin
  alter table public.mcs_teams add constraint mcs_teams_kind_check check (kind in ('pratique', 'match', 'programme'));
exception when duplicate_object then null; end $$;
