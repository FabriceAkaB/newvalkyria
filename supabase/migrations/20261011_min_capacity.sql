-- Taille de groupe affichée « entre X et Y joueurs » : min_capacity (affichage)
-- + max_capacity (limite réelle des inscriptions).
alter table public.session_programs add column if not exists min_capacity integer;
update public.session_programs set min_capacity = 12, max_capacity = 14 where slug in ('garcons-2018', 'garcons-2014-2015');
