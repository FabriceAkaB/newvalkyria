-- Photos des joueuses en stockage privé (Loi 25, JP 17 nov. 2026). photo_url garde l'adresse du site
-- (/photos/<dossier>/<fichier>) qui vérifie qui regarde avant de rediriger vers un lien signé (player-photos.ts).
-- À lancer APRÈS la mise en ligne du code qui sert /photos/… .
update public.players
set photo_url = '/photos/athlete-photos/' || regexp_replace(photo_url, '^.*/storage/v1/object/public/athlete-photos/', '')
where photo_url like '%/storage/v1/object/public/athlete-photos/%';
update public.children
set photo_url = '/photos/child-photos/' || regexp_replace(photo_url, '^.*/storage/v1/object/public/child-photos/', '')
where photo_url like '%/storage/v1/object/public/child-photos/%';
update storage.buckets set public = false where id in ('athlete-photos', 'child-photos');
