-- Permet à l'admin de "combler" des places du programme complet même sans
-- inscription réelle (ex. place réservée par téléphone, promesse verbale)
-- — comptées dans la capacité affichée publiquement sans créer de fausse
-- inscription.
alter table public.sport_etudes_settings add column if not exists manual_reserved_spots integer not null default 0;
