-- Type d'option : « formule » (forfait, une seule par entreprise) ou « chandail » (emplacement seul, en option).
-- Une formule peut aussi inclure un emplacement du chandail (slot_key) : il est alors vendu avec elle.
alter table public.partnership_offer_options add column if not exists kind text not null default 'formule' check (kind in ('formule', 'chandail'));
update public.partnership_offer_options set kind = 'chandail' where slot_key is not null and price_cents is null;
