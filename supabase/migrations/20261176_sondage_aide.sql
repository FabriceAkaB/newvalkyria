-- Borne de fin de pratique (JP, 20 nov. 2026) : les mêmes 4 questions à chaque fois.
-- Plaisir et fatigue (déjà là), puis « Ta coach t'a-t-elle aidée ou encouragée ? » (oui / non + quelles coachs)
-- et « Est-ce que quelqu'un t'a aidée aujourd'hui ? » (oui / non + quelles filles).
alter table public.activity_player_attendance add column if not exists coach_helped boolean;
alter table public.activity_player_attendance add column if not exists coach_helpers uuid[] not null default '{}';
alter table public.activity_player_attendance add column if not exists peer_helped boolean;
alter table public.activity_player_attendance add column if not exists peer_helpers uuid[] not null default '{}';
