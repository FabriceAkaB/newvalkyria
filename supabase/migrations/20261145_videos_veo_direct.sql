-- Vidéos lues directement chez Veo (demande de JP, 7 nov. 2026) : le site ne garde pas les fichiers, seulement le lien du
-- fichier 1080p de Veo, l'image d'aperçu, les périodes et les temps forts (buts, tirs… détectés par Veo) pour le lecteur.
-- « a-classer » : enregistrement « Newval » que le robot n'a pas pu placer seul (JP choisit l'activité dans l'admin).
alter table match_videos add column if not exists veo_slug text;
create unique index if not exists match_videos_veo_slug on match_videos (veo_slug) where veo_slug is not null;
alter table match_videos add column if not exists video_url text;
alter table match_videos add column if not exists thumbnail_url text;
alter table match_videos add column if not exists periods jsonb not null default '[]'::jsonb;
alter table match_videos add column if not exists highlights jsonb not null default '[]'::jsonb;
alter table match_videos add column if not exists veo_title text;
alter table match_videos alter column match_date drop not null;
alter table match_videos drop constraint if exists match_videos_status_check;
alter table match_videos add constraint match_videos_status_check check (status in ('importation', 'traitement', 'pret', 'erreur', 'a-classer'));
