-- Éducateur vidéaste (JP, 19 nov. 2026) : William filme les joueuses et dépose leurs vidéos de progression depuis
-- son portail, le jour même.
alter table public.coaches add column if not exists is_videographer boolean not null default false;
update public.coaches set is_videographer = true where first_name = 'William' and last_name = 'Sarrazin-Martinez';
