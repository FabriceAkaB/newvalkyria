-- Tâches reliées à une chose du site (ex. une commande de la boutique) : créées toutes seules, cochées toutes seules.
alter table team_tasks add column if not exists ref text;
create unique index if not exists team_tasks_open_ref on team_tasks (club_id, ref) where ref is not null and status in ('a_faire', 'en_cours');
