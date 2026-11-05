-- Le robot MonClubSportif note aussi les photos envoyées, les adversaires écrits et les rappels de présence déjà partis
-- (sinon il les refait à chaque passage). L'ancienne contrainte n'acceptait que « membre » et « evenement ».
alter table mcs_sync_items drop constraint if exists mcs_sync_items_kind_check;
alter table mcs_sync_items add constraint mcs_sync_items_kind_check
  check (kind in ('membre', 'evenement', 'photo', 'adversaire', 'rappel'));
