-- Champ de confirmation de présence — permet de distinguer une assignation
-- juste créée (présence pas encore validée par l'admin après l'activité)
-- d'une présence confirmée, pour les notifications "présence non validée".
alter table public.coach_assignments add column if not exists confirmed boolean not null default false;
