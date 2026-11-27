-- Adversaires (JP, 27 nov. 2026) : chaque club qui joue contre nous, actif ou archivé, avec ses équipes (catégorie,
-- calibre, combien d'équipes de cette catégorie), ajoutées par le formulaire du club ou à la main par JP.
alter table match_team_profiles add column if not exists archived_at timestamptz;
alter table match_team_profiles add column if not exists source text not null default 'formulaire';
alter table match_team_profiles add column if not exists team_count integer not null default 1;
-- Plage de match « en attente » : retenue (discussion en cours avec un club), plus offerte sur la page des clubs.
alter table match_slots add column if not exists on_hold boolean not null default false;
alter table match_slots add column if not exists hold_note text;
