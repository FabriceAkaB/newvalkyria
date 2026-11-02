-- Planification de l'année (Mandalart P1.1 / P1.3, section « périodisation ») : on garde une ligne par semaine dans
-- season_themes (thème de la semaine, déjà lu partout) et on ajoute le bloc de 4 à 6 semaines, la semaine de tests
-- du mois et, au besoin, un thème différent pour une catégorie ({"2016": "Conduite"}).
alter table public.season_themes add column if not exists block_label text;
alter table public.season_themes add column if not exists test_week boolean not null default false;
alter table public.season_themes add column if not exists by_category jsonb not null default '{}'::jsonb;
