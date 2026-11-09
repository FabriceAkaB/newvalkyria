-- La présence d'un éducateur marquée dans MonClubSportif sert de « punch » pour la paie :
-- le robot confirme l'assignation avec confirmed_by = 'MonClubSportif' (refusé jusqu'ici par la contrainte).
alter table coach_assignments drop constraint if exists coach_assignments_confirmed_by_check;
alter table coach_assignments add constraint coach_assignments_confirmed_by_check
  check (confirmed_by is null or confirmed_by = any (array['educateur', 'admin', 'MonClubSportif']));
