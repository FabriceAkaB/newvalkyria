-- ── Plages horaires : configuration persistante ──────────────────
CREATE TABLE IF NOT EXISTS public.slot_configs (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  day         TEXT NOT NULL,
  horaire     TEXT NOT NULL,
  category    TEXT NOT NULL,
  practices   INTEGER NOT NULL DEFAULT 15,
  max_places  INTEGER NOT NULL DEFAULT 10,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.slot_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role can manage slot_configs" ON public.slot_configs;
CREATE POLICY "service role can manage slot_configs"
  ON public.slot_configs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
