-- Voix des familles (JP, 17 nov. 2026) : chaque idée ou commentaire a un responsable ; ce qui dépasse 3 jours sans
-- réponse remonte en rouge dans « Aujourd'hui ».
alter table public.idea_box add column if not exists owner text;
