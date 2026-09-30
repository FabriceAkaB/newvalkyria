-- Schéma visuel (constructeur glisser-déposer) pour un exercice — additif,
-- ne remplace pas image_url (photo statique) qui reste disponible en
-- parallèle. Structure : { elements: [{id,type,x,y,label}], arrows:
-- [{id,type,x1,y1,x2,y2}] }, x/y en pourcentage (0-100) du terrain affiché.
alter table public.exercises add column if not exists diagram_data jsonb;
