-- Restrictions fines par plage de match : liste de catégories admises (genre + années de
-- naissance), p. ex. « garçons nés en 2014 » ou « filles nées en 2015 », et une précision
-- « recherché » (p. ex. « équipe 2014 recherchée »). Quand allowed_categories est nul,
-- les anciennes colonnes (allowed_gender / birth_year_min / birth_year_max) s'appliquent.
alter table public.match_slots add column if not exists allowed_categories jsonb;
alter table public.match_slots add column if not exists preferred_note text;
