-- Robot MonClubSportif : marque « demi-saison » (joueuse retirée des activités après sa fin) et
-- « nouvelle-activite » (activité ajoutée dans MonClubSportif, JP averti une fois).
alter table public.mcs_sync_items drop constraint if exists mcs_sync_items_kind_check;
alter table public.mcs_sync_items add constraint mcs_sync_items_kind_check
  check (kind = any (array['membre', 'evenement', 'photo', 'adversaire', 'rappel', 'membre-robot', 'avis-mcs', 'demi-saison', 'nouvelle-activite']));
