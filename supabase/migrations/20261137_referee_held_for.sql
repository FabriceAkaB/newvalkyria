-- Poste d'arbitre gardé pour une personne précise (prénom), ex. « Simon » : les autres arbitres ne le voient pas
-- dans leur page ni dans les courriels de matchs ouverts, et ne peuvent pas le réserver.
alter table public.referee_assignments add column if not exists held_for text;
