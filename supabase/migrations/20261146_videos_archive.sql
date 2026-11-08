-- Vidéos Veo gardées par l'académie (demande de JP, 7 nov. 2026) : Veo efface ses enregistrements environ un an
-- après le match. Le site télécharge chaque fichier 1080p (et son aperçu) dans le stockage privé « match-videos » ;
-- tant que Veo répond, on lit chez Veo, ensuite la copie de l'académie prend le relais (src/lib/video-archive.ts).
alter table public.match_videos add column if not exists archive_status text not null default 'a-faire';
alter table public.match_videos add column if not exists archive_path text;
alter table public.match_videos add column if not exists archive_thumb_path text;
alter table public.match_videos add column if not exists archive_size bigint;
alter table public.match_videos add column if not exists archive_bytes bigint not null default 0;
alter table public.match_videos add column if not exists archive_upload_url text;
alter table public.match_videos add column if not exists archive_error text;
alter table public.match_videos add column if not exists archived_at timestamptz;
alter table public.match_videos add column if not exists veo_expired boolean not null default false;
do $$ begin
  alter table public.match_videos add constraint match_videos_archive_status_check check (archive_status in ('a-faire', 'en-cours', 'fait', 'erreur'));
exception when duplicate_object then null; end $$;
-- Les vidéos déjà marquées « plus disponibles chez Veo » le sont désormais par veo_expired.
update public.match_videos set veo_expired = true where error = 'Le fichier n''est plus disponible chez Veo (expiré ou retiré).';
-- Le compartiment privé garde aussi l'aperçu de chaque vidéo.
update storage.buckets set allowed_mime_types = array['video/*', 'video/mp4', 'image/jpeg', 'image/png', 'image/webp'] where id = 'match-videos';
