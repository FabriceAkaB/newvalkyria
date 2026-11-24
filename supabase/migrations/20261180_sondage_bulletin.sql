-- Bulletin ouvert après le sondage de satisfaction (P4.8.18, P3.8.19, 25 nov. 2026) :
-- le parent qui a donné 9 ou 10 a-t-il cliqué « Laisser cet avis sur Google » ? (on ne voit pas la publication elle-même)
alter table survey_responses add column if not exists google_clicked_at timestamptz;
