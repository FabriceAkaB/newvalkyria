-- Borne de fin de pratique (JP, 25 nov. 2026) : « Qu'est-ce qu'on a travaillé aujourd'hui ? », 3 choix dont un seul
-- est le thème de la semaine du groupe. On garde le choix de la fille, le bon thème au moment de la question, les
-- 3 choix proposés et si c'est correct : les éducateurs et JP voient qui a compris le thème.
alter table public.activity_player_attendance add column if not exists theme_answer text;
alter table public.activity_player_attendance add column if not exists theme_expected text;
alter table public.activity_player_attendance add column if not exists theme_choices text[];
alter table public.activity_player_attendance add column if not exists theme_correct boolean;
