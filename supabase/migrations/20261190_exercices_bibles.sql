-- Plusieurs Bibles d'exercices (JP, 26 nov. 2026) : La Bible New Valkyria, La Bible de la psychomotricité
-- (les 200 exercices que JP va déposer) et La Bible du ball mastery (routines + bibliothèque des gestes).
-- Chaque exercice est rangé dans une seule Bible.
alter table public.exercises add column if not exists bible text not null default 'valkyria';
do $$ begin
  alter table public.exercises add constraint exercises_bible_check check (bible in ('valkyria', 'psychomotricite', 'ball-mastery'));
exception when duplicate_object then null; end $$;
create index if not exists exercises_bible_idx on public.exercises (bible);

-- « Pour ce qui est du ball mastery, tu peux tous les mettre là-bas » : les routines de ball mastery déjà dans la banque.
update public.exercises set bible = 'ball-mastery'
where bible = 'valkyria' and (exercise_type = 'ball-mastery' or lower(coalesce(category, '')) = 'ball mastery');
