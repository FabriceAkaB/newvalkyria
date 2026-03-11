-- ── Admin: ajout is_waitlist sur leads ──────────────────────────────
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS is_waitlist BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Capacité par catégorie (modifiable par l'admin) ──────────────────
CREATE TABLE IF NOT EXISTS public.capacity_config (
  category    TEXT PRIMARY KEY,
  max_spots   INTEGER NOT NULL DEFAULT 10,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.capacity_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role can manage capacity_config" ON public.capacity_config;
CREATE POLICY "service role can manage capacity_config"
  ON public.capacity_config
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
