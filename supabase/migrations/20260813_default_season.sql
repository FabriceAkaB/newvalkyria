-- Corrige la saison "par défaut" : la ligne vestige "ete-2026" (jamais
-- utilisée pour les vraies saisons) portait is_active=true depuis la
-- migration fondatrice, alors que c'est la vraie saison en cours
-- (Automne/Hiver 2026) qui doit l'être.
update public.seasons set is_active = false where id = 'ete-2026';
update public.seasons set is_active = true where id = 'automne-hiver-2026';
