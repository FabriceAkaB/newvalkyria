-- Banque d'exercices sans doublons (JP, 26 nov. 2026) : l'empreinte (SHA-256) de la diapo de chaque exercice.
-- La Bible montre une seule fois les exercices qui ont la même diapo (les autres deviennent ses « autres versions »)
-- et l'ajout par diapo refuse une diapo déjà dans la banque.
alter table public.exercises add column if not exists image_hash text;
create index if not exists exercises_image_hash_idx on public.exercises (image_hash);
