-- « Ball mastery fait aujourd'hui ? Oui / Non » (JP, 25 nov. 2026) : un éducateur de la pratique répond dans son rapport
-- (ou JP depuis l'admin), une fois pour toute la pratique. On réutilise le drapeau « pas fait » des blocs du plan
-- (20261117_exercice_pas_fait.sql) : « Non » = blocs de ball mastery not_done ; « Oui » = not_done faux avec
-- not_done_by / not_done_at remplis. not_done_at = quand on a répondu. Les gestes déjà notés restent en base mais ne
-- comptent plus quand c'est « Non » (ball-mastery-skip.ts).
alter table public.activity_session_blocks add column if not exists not_done_at timestamptz;
create index if not exists activity_session_blocks_not_done_idx on public.activity_session_blocks (activity_id) where not_done;
