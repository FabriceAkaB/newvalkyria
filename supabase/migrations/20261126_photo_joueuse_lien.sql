-- Photo de chaque joueuse déposée par sa famille sans compte (demande de JP, 3 nov. 2026) : un lien personnel par
-- joueuse (/photo/[jeton]). La photo sert aux éducateurs à reconnaître la fille ; l'accord de publication (droit à
-- l'image, P8.1.01) est demandé à part, case non cochée par défaut (players.image_consent).
alter table public.players add column if not exists photo_token text;
create unique index if not exists players_photo_token_key on public.players (photo_token) where photo_token is not null;
alter table public.players add column if not exists image_consent_at timestamptz;
