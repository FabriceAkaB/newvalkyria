-- Matchs à l'interne (JP, 27 nov. 2026) : une plage de match jouée entre nos propres équipes (ex. 2015 AV c. 2015 INT).
-- 0 $ encaissé ; le terrain, les arbitres et les éducateurs restent des coûts. Rubrique dans Arbitres et bilan.
alter table match_slots add column if not exists internal_teams text;
alter table match_slots add column if not exists internal_marked_at timestamptz;
