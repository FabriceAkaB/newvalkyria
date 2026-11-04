-- Tous les matchs de New Valkyria se jouent à 7 contre 7 (demande de JP) : valeur par défaut et plages existantes.
alter table public.match_slots alter column match_format set default '7 vs 7';
update public.match_slots set match_format = '7 vs 7' where match_format is null or btrim(match_format) = '';
