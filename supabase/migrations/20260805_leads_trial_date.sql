-- Date d'essai planifiée pour les leads Été (statut "essai") — permet de les
-- faire apparaître dans le calendrier admin des essais, aux côtés des
-- inscriptions "essai" de la saison Automne/Hiver (registrations.trial_date).
alter table public.leads add column if not exists trial_date date;
create index if not exists leads_trial_date_idx on public.leads (trial_date);
