import type { Entity } from '../store/useGameStore';

// One-off visual effects (arrows, damage numbers, falling units), worked out by
// comparing each state_update with the one before it. Purely cosmetic: the
// server has already applied the damage by the time these are drawn.

/** How long an effect stays in the store. Each effect's own animation is shorter. */
export const EFFECT_LIFETIME_MS = 900;

/** Mirrors the Battle Mage's splashRadius in server/src/game/units.ts (world units). */
export const CASTER_SPLASH_RADIUS = 45;

interface EffectBase {
  id: string;
  at: number; // Date.now() when it was created
}

export type Effect =
  | (EffectBase & { kind: 'projectile'; style: 'arrow' | 'blast'; fromX: number; fromY: number; toX: number; toY: number; ownerId: string })
  | (EffectBase & { kind: 'damage'; x: number; y: number; amount: number })
  | (EffectBase & { kind: 'death'; entity: Entity });

let nextId = 1;
const newId = (kind: string) => `${kind}_${nextId++}`;

export function deriveEffects(prev: Entity[], next: Entity[], killedIds: string[], now: number): Effect[] {
  if (!prev.length && !killedIds.length) return [];
  const prevById = new Map(prev.map((e) => [e.id, e]));
  const nextById = new Map(next.map((e) => [e.id, e]));
  const effects: Effect[] = [];

  for (const unit of next) {
    const before = prevById.get(unit.id);
    if (!before) continue;

    if (unit.health < before.health) {
      effects.push({ id: newId('dmg'), at: now, kind: 'damage', x: unit.x, y: unit.y, amount: before.health - unit.health });
    }

    // A new hit by a ranged unit or caster: draw the shot flying to its target
    const isShooter = unit.type === 'Ranged' || unit.type === 'Caster';
    if (isShooter && unit.lastHitTick !== before.lastHitTick && unit.lastHitTick >= 0 && unit.targetId) {
      const target = nextById.get(unit.targetId) ?? prevById.get(unit.targetId);
      if (target) {
        effects.push({
          id: newId('shot'),
          at: now,
          kind: 'projectile',
          style: unit.type === 'Ranged' ? 'arrow' : 'blast',
          fromX: unit.x,
          fromY: unit.y,
          toX: target.x,
          toY: target.y,
          ownerId: unit.ownerId,
        });
      }
    }
  }

  for (const id of killedIds) {
    const last = prevById.get(id);
    if (!last) continue;
    if (last.health > 0) {
      effects.push({ id: newId('dmg'), at: now, kind: 'damage', x: last.x, y: last.y, amount: last.health });
    }
    effects.push({ id: newId('death'), at: now, kind: 'death', entity: { ...last, health: 0 } });
  }

  return effects;
}

/** Drops expired effects and adds new ones; returns the same array when nothing changed (no re-render). */
export function updateEffects(current: Effect[], fresh: Effect[], now: number): Effect[] {
  const kept = current.filter((e) => now - e.at < EFFECT_LIFETIME_MS);
  if (!fresh.length && kept.length === current.length) return current;
  return fresh.length ? [...kept, ...fresh] : kept;
}
