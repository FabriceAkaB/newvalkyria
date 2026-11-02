-- Portail des éducateurs (Mandalart P1.4.08, P1.2.08, P1.5.06, P1.4.09, P8.3.04, P8.3.05).
-- Aucune nouvelle table : on étend les tables existantes du portail entraîneur.

-- Pratique du jour : chaque bloc du plan de séance dit aussi le montage du terrain, le matériel,
-- qui fait quoi, les points clés, les variantes et les progressions (en plus de l'exercice lié).
alter table public.activity_session_blocks add column if not exists setup text;
alter table public.activity_session_blocks add column if not exists material text;
alter table public.activity_session_blocks add column if not exists roles text;
alter table public.activity_session_blocks add column if not exists key_points text;
alter table public.activity_session_blocks add column if not exists variants text;
alter table public.activity_session_blocks add column if not exists progressions text;

-- Routine de fin : chaque joueuse donne sa note de la pratique (sur 10) et sa fatigue (sur 10) ;
-- l'éducateur les saisit sur la ligne de présence de la joueuse.
alter table public.activity_player_attendance add column if not exists practice_rating smallint check (practice_rating between 0 and 10);
alter table public.activity_player_attendance add column if not exists fatigue smallint check (fatigue between 0 and 10);
alter table public.activity_player_attendance add column if not exists feedback_at timestamptz;

-- Présence de l'éducateur : confirmée par lui (portail) ou par l'admin, et relance à 24 h.
alter table public.coach_assignments add column if not exists confirmed_at timestamptz;
alter table public.coach_assignments add column if not exists confirmed_by text check (confirmed_by in ('educateur', 'admin'));
alter table public.coach_assignments add column if not exists reminder_sent_at timestamptz;

create index if not exists player_evaluations_coach_idx on public.player_evaluations (coach_id, created_at desc);
