-- Calendrier de contenu de l'académie sur 90 jours (P3.2.25, 1er déc. 2026 au 28 févr. 2027).
-- Les publications du plan sont des tournages (jp_video_shoots, série « plan-90 ») ; on ajoute leur place dans
-- l'entonnoir (haut, milieu, bas) et leur famille de contenu (éducatif, démonstratif, coulisses, histoires, preuve).
alter table public.jp_video_shoots add column if not exists funnel text;
alter table public.jp_video_shoots add column if not exists content_family text;
create index if not exists jp_video_shoots_series_idx on public.jp_video_shoots (club_id, series);
