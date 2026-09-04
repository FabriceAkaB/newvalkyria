-- La catégorie "2017" (Automne/Hiver) regroupe maintenant les naissances
-- 2017 ET 2018 — id technique inchangé (aucune migration des inscriptions
-- existantes nécessaire, voir src/lib/season-2027.ts::birthYearFromDob),
-- seul le libellé affiché change.
update public.birth_categories
set label = '2017-2018'
where season_id = 'automne-hiver-2026' and id = '2017';
