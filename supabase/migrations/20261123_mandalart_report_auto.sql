-- Report automatique des tâches du Mandalart (demande de JP, 2 nov. 2026) : une tâche pas faite à sa date passe au
-- lendemain, les tâches qui suivent dans le même objectif glissent au besoin, les tâches à date fixe ne bougent jamais.
-- La date effective est mandalart_tasks_state.due (colonne déjà là) ; planned_due garde la date d'origine du plan.
alter table public.mandalart_tasks_state add column if not exists fixed boolean not null default false;
alter table public.mandalart_tasks_state add column if not exists planned_due date;
alter table public.mandalart_tasks_state add column if not exists postponed_count integer not null default 0;
