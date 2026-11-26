-- MonClubSportif fait foi pour les présences des joueuses (JP, 26 nov. 2026).
-- Sur chaque présence : d'où vient l'état retenu (mcs, educateur, borne) et le dernier état lu dans MonClubSportif
-- (present, late, uncertain, absent, unknown = pas de réponse). L'état de MCS l'emporte quand MCS a une réponse ;
-- la marque de l'éducateur ou de la borne ne sert que quand MCS n'a rien.
alter table public.activity_player_attendance add column if not exists status_source text
  check (status_source is null or status_source in ('mcs', 'educateur', 'borne'));
alter table public.activity_player_attendance add column if not exists mcs_status text;
alter table public.activity_player_attendance add column if not exists mcs_read_at timestamptz;

-- Sur chaque activité : les inscriptions assignées dans MonClubSportif (les filles attendues, remplaçantes et invitées
-- comprises), les événements MCS lus et si la pratique est annulée dans MCS (elle ne compte alors dans aucune présence).
alter table public.coach_activities add column if not exists mcs_expected uuid[];
alter table public.coach_activities add column if not exists mcs_event_ids bigint[];
alter table public.coach_activities add column if not exists mcs_cancelled boolean not null default false;
alter table public.coach_activities add column if not exists mcs_read_at timestamptz;
create index if not exists coach_activities_mcs_expected_idx on public.coach_activities using gin (mcs_expected);
