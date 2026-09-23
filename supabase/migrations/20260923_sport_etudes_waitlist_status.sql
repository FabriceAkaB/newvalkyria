-- Ajoute le statut "waitlist" (liste d'attente) aux inscriptions Sport-Études,
-- pour mettre manuellement un joueur de côté sans le confirmer ni l'annuler
-- (miroir du statut équivalent déjà utilisé sur les inscriptions saison).
alter table public.sport_etudes_registrations drop constraint if exists sport_etudes_registrations_status_check;
alter table public.sport_etudes_registrations add constraint sport_etudes_registrations_status_check
  check (status in ('pending','confirmed','paid','waitlist','cancelled'));
