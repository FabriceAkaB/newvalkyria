import { Gift, ShoppingBag, Star, Target, Ticket, Trophy, Users, type LucideIcon } from "lucide-react";

import type { ChampionKind, RewardKind } from "@/lib/player-points";

/** Icônes sobres de l'espace famille (Lucide, comme l'admin) à la place des émojis (JP, 19 nov. 2026). */
const CHAMPION: Record<ChampionKind, LucideIcon> = { individuel: Trophy, groupe: Users, attitude: Star, special: Target };
const REWARD: Record<RewardKind, LucideIcon> = { cadeau: Gift, "rabais-boutique": ShoppingBag, "credit-saison": Ticket };

export function ChampionKindIcon({ kind, size = 16 }: { kind: string; size?: number }) {
  const I = CHAMPION[kind as ChampionKind] ?? Trophy;
  return <I size={size} strokeWidth={1.75} aria-hidden />;
}

export function RewardKindIcon({ kind, size = 20 }: { kind: string; size?: number }) {
  const I = REWARD[kind as RewardKind] ?? Gift;
  return <I size={size} strokeWidth={1.75} aria-hidden />;
}
