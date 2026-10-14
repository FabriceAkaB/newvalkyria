-- Prix négociés : price_cents = prix réellement demandé pour l'emplacement, list_price_cents = tarif du document.
alter table public.sponsor_slots_2027 add column if not exists list_price_cents integer;
update public.sponsor_slots_2027 set list_price_cents = price_cents where list_price_cents is null;
