-- Boîte à suggestions des coachs (JP, 19 nov. 2026) : les éducateurs proposent leurs idées depuis leur portail,
-- dans la même boîte que les familles (source « coach »).
alter table public.idea_box drop constraint if exists idea_box_source_check;
alter table public.idea_box add constraint idea_box_source_check check (source in ('site', 'espace', 'coach'));
