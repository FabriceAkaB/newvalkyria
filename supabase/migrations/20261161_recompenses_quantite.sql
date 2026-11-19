-- Prix uniques (JP, 18 nov. 2026) : une récompense peut n'exister qu'en quelques exemplaires (ex. 1 grosse peluche
-- New Valkyria : une seule gagnante) ; vide = autant qu'on veut.
alter table public.point_rewards add column if not exists stock integer;
