-- Heure de rapport accordée à la main par JP (25 nov. 2026) : un assistant qui a rempli des rapports
-- journaliers (William) est payé 1 h de rapport ces jours-là, même si la règle la réserve aux coachs.
alter table coach_assignments add column if not exists report_hour_granted_at timestamptz;
alter table coach_assignments add column if not exists report_hour_granted_by text;
