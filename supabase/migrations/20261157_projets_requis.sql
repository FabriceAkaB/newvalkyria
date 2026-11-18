-- Responsable financier (JP, 17 nov. 2026) : ce qu'on coche à la main avant de lancer un projet (lieu, éducateurs, assurance…).
alter table launch_scenarios add column if not exists checks jsonb not null default '{}'::jsonb;
