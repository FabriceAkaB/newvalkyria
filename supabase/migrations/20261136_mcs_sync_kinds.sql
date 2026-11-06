-- Robot MonClubSportif : marque « membre-robot » (joueuse vue ou ajoutée dans une équipe MCS) et « avis-mcs »
-- (JP déjà averti qu'une joueuse payée n'est pas encore dans MCS).
alter table public.mcs_sync_items drop constraint if exists mcs_sync_items_kind_check;
alter table public.mcs_sync_items add constraint mcs_sync_items_kind_check
  check (kind = any (array['membre', 'evenement', 'photo', 'adversaire', 'rappel', 'membre-robot', 'avis-mcs']));
