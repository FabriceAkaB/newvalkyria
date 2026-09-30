-- Permet d'attacher des documents (slides d'entraînement, etc.) directement
-- à une activité de coach (coach_activities), en plus des types déjà permis.
alter table public.documents drop constraint documents_entity_type_check;
alter table public.documents add constraint documents_entity_type_check
  check (entity_type in ('registration', 'lead', 'coach', 'coach_activity'));
