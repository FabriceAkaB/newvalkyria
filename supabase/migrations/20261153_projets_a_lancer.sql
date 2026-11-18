-- Projets à lancer (JP, 17 nov. 2026) : un scénario du calculateur peut être relié à un projet du sondage d'intérêt
-- (camp des Fêtes, relâche, été, haute performance, Roses, tournées en Ontario, préparatoire Sport-Études, saison prochaine).
alter table launch_scenarios add column if not exists project_key text;
create index if not exists launch_scenarios_project on launch_scenarios (club_id, project_key) where project_key is not null;

-- Le calendrier de contenu sert deux comptes : New Valkyria et JP Coach (marque personnelle de JP).
alter table jp_video_shoots add column if not exists account text not null default 'newvalkyria';
