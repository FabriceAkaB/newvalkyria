-- Bucket public pour les images de la bibliothèque d'exercices (schémas,
-- photos de mise en place) — même patron que child-photos, contenu non
-- sensible destiné à être affiché directement aux entraîneurs.
insert into storage.buckets (id, name, public)
values ('exercise-images', 'exercise-images', true)
on conflict (id) do nothing;
