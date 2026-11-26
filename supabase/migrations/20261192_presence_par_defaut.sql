-- Présente par défaut (JP, 26 nov. 2026) : une fille assignée à la pratique dans MonClubSportif qui n'a pas mis sa
-- présence, et que personne n'a marquée, est notée présente avec la source « defaut ».
alter table activity_player_attendance drop constraint if exists activity_player_attendance_status_source_check;
alter table activity_player_attendance add constraint activity_player_attendance_status_source_check
  check (status_source is null or status_source in ('mcs', 'educateur', 'borne', 'defaut'));
