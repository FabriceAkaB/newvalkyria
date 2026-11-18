-- Envois programmés dans MonClubSportif (JP, 17 nov. 2026 : « les sondages doivent être dans MonClubSportif ») :
-- une publication privée de l'équipe, aux membres choisis, à l'heure prévue, par le cron horaire mcs-robot.
alter table scheduled_emails add column if not exists channel text not null default 'email';
alter table scheduled_emails add column if not exists mcs_team_id integer;
alter table scheduled_emails add column if not exists mcs_season_id integer;
alter table scheduled_emails add column if not exists mcs_member_ids integer[];
alter table scheduled_emails add column if not exists ref text;
