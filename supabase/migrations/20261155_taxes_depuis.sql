-- TPS/TVQ (JP, 17 nov. 2026) : la taxe ne se déduit des revenus qu'à partir de l'inscription aux taxes ; avant, tout est à nous.
alter table revenue_settings add column if not exists revenue_tax_from date;
