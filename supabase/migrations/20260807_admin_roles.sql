-- Rôles admin — permet un compte "Gérante" séparé avec accès limité
-- (inscriptions/essais/groupes) sans jamais voir les données financières.
-- Les sessions existantes deviennent 'admin' par défaut (aucune rupture
-- pour le compte principal déjà connecté).
alter table public.admin_sessions add column if not exists role text not null default 'admin';
