-- Anciennes familles : leur lien donne un rabais à la famille référée, mais
-- elles ne reçoivent pas de récompense (sac / crédit). Par défaut : récompense activée.
alter table public.referral_codes add column if not exists rewards_enabled boolean not null default true;
