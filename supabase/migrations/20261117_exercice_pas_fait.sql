-- « On ne l'a pas fait » (JP, 17 nov. 2026) : un exercice prévu dans le plan mais pas joué pendant la pratique.
-- L'éducateur le marque au lieu de le noter ; il ne compte pas dans le rapport ni dans la note de l'exercice.
alter table public.activity_session_blocks add column if not exists not_done boolean not null default false;
alter table public.activity_session_blocks add column if not exists not_done_note text;
alter table public.activity_session_blocks add column if not exists not_done_by uuid;
