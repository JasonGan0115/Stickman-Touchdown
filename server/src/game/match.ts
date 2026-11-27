import {
  ENDZONE_DEPTH,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  MANA_PER_TICK,
  MATCH_DURATION_MS,
  MAX_MANA,
  OVERTIME_MANA_MULTIPLIER,
  RESET_MANA_ON_SCORE,
  SPAWN_COOLDOWN_TICKS,
  STARTING_MANA,
  TICK_MS,
  WINNING_SCORE,
} from "./constants";
import { combineAugments, type Modifiers } from "./augments";
import { getTroopStatMultiplier } from "./troopLevels";
import {
  getSpellStats,
  getTowerStats,
  getUnitStats,
  resolveHand,
  type MovementType,
  type SpellStats,
  type TowerStats,
  type UnitStats,
  type UnitType,
} from "./units";

// Pure match state + rules. No sockets or timers here, so it can be tested on its own.

export type PlayerNumber = 1 | 2;
export type MatchMode = "standard" | "tournament";

export interface Loadout {
  unitIds: string[]; // Card ids
  augmentIds: string[]; // Augment ids
}

export interface Entity {
  id: string;
  cardId: string;
  type: UnitType | "Tower";
  movement: MovementType;
  ownerId: string; // socket id of the player who spawned it
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  damage: number;
  attackRange: number;
  attackIntervalTicks: number;
  speed: number; // world units per tick
  splashRadius: number;
  state: "moving" | "attacking";
  targetId: string | null;
  attackCooldown: number; // ticks until this unit may hit again
  lastHitTick: number; // match tick of this unit's latest hit, -1 if it hasn't hit yet (drives client animations)
  isBuilding?: boolean;
  lifetimeTicks?: number;
  tauntRadius?: number;
  applySlowFactor?: number;
  applySlowDurationTicks?: number;
  slowUntilTick?: number;
  slowFactor?: number;
  stunUntilTick?: number;
}

export interface PlayerState {
  id: string; // socket id
  username: string;
  number: PlayerNumber; // 1 starts at the bottom and attacks upward, 2 the reverse
  mana: number; // fractional; regenerates every tick
  score: number;
  loadout: Loadout;
  hand: string[]; // active 4 cards currently in hand
  drawQueue: string[]; // remaining cards in deck awaiting cycle
  spawnCooldownTicks: number; // placement cooldown (1s)
  modifiers: Modifiers; // combined augment boosts, applied to every unit this player spawns
  troopLevels: Record<string, number>; // cardId -> troop level (1..100)
  playedCardCounts: Record<string, number>; // cardId -> spawn count during this match
}

export type MatchPhase = "kickoff" | "playing" | "comeback_draft";

export interface Match {
  id: string; // also the Socket.io room name
  mode: MatchMode;
  phase: MatchPhase;
  players: [PlayerState, PlayerState];
  entities: Entity[];
  tick: number;
  nextTickAt: number; // epoch ms when the next tick is due
  endsAt: number; // epoch ms
  overtime?: boolean;
  ended: boolean;
  nextEntityNumber: number;
  interval?: NodeJS.Timeout;
}

export interface MatchSeat {
  id: string;
  username: string;
  loadout: Loadout;
  troopLevels?: Record<string, number>;
}

export type SpawnRejection =
  | "invalid_coordinates"
  | "unknown_card"
  | "card_not_in_hand"
  | "not_enough_mana"
  | "cooldown_active"
  | "outside_home_endzone"
  | "outside_defensive_zone";

/** Things that happened during a tick, for logging. */
export interface TickEvents {
  scored: { scorer: PlayerState; entity: Entity }[];
  // A unit started attacking this tick; health is captured before this tick's damage
  engaged: { attacker: Entity; target: Entity; attackerHealth: number; targetHealth: number }[];
  hits: { attacker: Entity; target: Entity; splash: boolean }[];
  killed: Entity[];
  roundReset: boolean;
}

/** Adds an augment to a player's loadout mid-match and re-computes modifiers. */
export function applyAugment(player: PlayerState, augmentId: string): void {
  player.loadout.augmentIds.push(augmentId);
  player.modifiers = combineAugments(player.loadout.augmentIds);
}

export function createMatch(id: string, mode: MatchMode, p1: MatchSeat, p2: MatchSeat): Match {
  const now = Date.now();
  const player = (seat: MatchSeat, number: PlayerNumber): PlayerState => {
    const { hand, drawQueue } = resolveHand(seat.loadout.unitIds);
    return {
      ...seat,
      number,
      mana: STARTING_MANA,
      score: 0,
      hand,
      drawQueue,
      spawnCooldownTicks: 0,
      modifiers: combineAugments(seat.loadout.augmentIds),
      troopLevels: seat.troopLevels ?? {},
      playedCardCounts: {},
    };
  };
  return {
    id,
    mode,
    phase: "playing",
    players: [player(p1, 1), player(p2, 2)],
    entities: [],
    tick: 0,
    nextTickAt: now + TICK_MS,
    endsAt: now + MATCH_DURATION_MS,
    overtime: false,
    ended: false,
    nextEntityNumber: 1,
  };
}

export function getPlayer(match: Match, socketId: string): PlayerState | undefined {
  return match.players.find((p) => p.id === socketId);
}

export function getOpponent(match: Match, socketId: string): PlayerState | undefined {
  return match.players.find((p) => p.id !== socketId);
}

export function isInHomeEndzone(player: PlayerNumber, y: number): boolean {
  return player === 1 ? y >= FIELD_HEIGHT - ENDZONE_DEPTH : y <= ENDZONE_DEPTH;
}

/** Defensive quarter-zone where deployable towers may be placed. */
export function isInDefensiveZone(player: PlayerNumber, y: number): boolean {
  return player === 1
    ? y >= FIELD_HEIGHT * 0.65 && y <= FIELD_HEIGHT - 20
    : y >= 20 && y <= FIELD_HEIGHT * 0.35;
}

/** True once an entity owned by `player` has reached the opponent's endzone. */
function hasReachedEnemyEndzone(player: PlayerNumber, y: number): boolean {
  return player === 1 ? y <= ENDZONE_DEPTH : y >= FIELD_HEIGHT - ENDZONE_DEPTH;
}

const inRange = (n: unknown, max: number): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= max;

/**
 * Creates a unit of the given card for `player`, boosted by the player's
 * augments, and adds it to the field. No validation; see trySpawn.
 */
export function addUnit(match: Match, player: PlayerState, stats: UnitStats, x: number, y: number): Entity {
  const mods = player.modifiers;
  const levelMult = getTroopStatMultiplier(player.troopLevels?.[stats.cardId] ?? 1);
  const health = Math.round(stats.health * mods.health * levelMult);
  const entity: Entity = {
    id: `unit_${match.nextEntityNumber++}`,
    cardId: stats.cardId,
    type: stats.type,
    movement: stats.movement,
    ownerId: player.id,
    x,
    y,
    health,
    maxHealth: health,
    damage: Math.round(stats.damage * mods.damage * levelMult),
    attackRange: stats.attackRange * mods.range,
    attackIntervalTicks: Math.max(1, Math.round(stats.attackIntervalTicks / mods.attackSpeed)),
    speed: stats.speed * mods.speed,
    splashRadius: stats.splashRadius,
    state: "moving",
    targetId: null,
    attackCooldown: 0,
    lastHitTick: -1,
  };
  match.entities.push(entity);
  return entity;
}

/** Creates a deployable defensive tower for `player` and adds it to the field. */
export function addTower(match: Match, player: PlayerState, stats: TowerStats, x: number, y: number): Entity {
  const mods = player.modifiers;
  const levelMult = getTroopStatMultiplier(player.troopLevels?.[stats.cardId] ?? 1);
  const health = Math.round(stats.health * mods.health * levelMult);
  const entity: Entity = {
    id: `tower_${match.nextEntityNumber++}`,
    cardId: stats.cardId,
    type: "Tower",
    movement: "walking",
    ownerId: player.id,
    x,
    y,
    health,
    maxHealth: health,
    damage: Math.round(stats.damage * mods.damage * levelMult),
    attackRange: stats.attackRange * mods.range,
    attackIntervalTicks: Math.max(1, Math.round(stats.attackIntervalTicks / mods.attackSpeed)),
    speed: 0,
    splashRadius: stats.splashRadius,
    state: "moving",
    targetId: null,
    attackCooldown: 0,
    lastHitTick: -1,
    isBuilding: true,
    lifetimeTicks: stats.lifetimeTicks,
    tauntRadius: stats.tauntRadius,
    applySlowFactor: stats.slowFactor,
    applySlowDurationTicks: stats.slowDurationTicks,
  };
  match.entities.push(entity);
  return entity;
}

function cycleHandCard(player: PlayerState, cardId: string): void {
  if (player.drawQueue.length > 0) {
    const nextCard = player.drawQueue.shift()!;
    const handIndex = player.hand.indexOf(cardId);
    if (handIndex !== -1) {
      player.hand[handIndex] = nextCard;
    } else {
      player.hand.push(nextCard);
    }
    player.drawQueue.push(cardId);
  }
}

export type TrySpawnResult =
  | { ok: true; isSpell?: false; entity: Entity; stats: UnitStats | TowerStats; hand: string[]; drawQueue: string[] }
  | { ok: true; isSpell: true; spell: SpellStats; x: number; y: number; hand: string[]; drawQueue: string[] }
  | { ok: false; reason: SpawnRejection; cost?: number; cooldownTicks?: number };

/** Applies a tactical spell at (x, y) on enemy entities within radius. */
function applySpellEffect(match: Match, player: PlayerState, spell: SpellStats, x: number, y: number): void {
  const minSafeY = ENDZONE_DEPTH + 1;
  const maxSafeY = FIELD_HEIGHT - ENDZONE_DEPTH - 1;

  for (const target of match.entities) {
    if (target.ownerId === player.id) continue;
    const dx = target.x - x;
    const dy = target.y - y;
    const dist = Math.hypot(dx, dy);
    if (dist > spell.radius) continue;

    if (spell.damage > 0) {
      target.health = Math.max(0, target.health - spell.damage);
    }
    if (spell.stunDurationTicks) {
      target.stunUntilTick = Math.max(target.stunUntilTick ?? 0, match.tick + spell.stunDurationTicks);
    }
    if (spell.slowFactor !== undefined && spell.slowDurationTicks) {
      target.slowFactor = spell.slowFactor;
      target.slowUntilTick = Math.max(target.slowUntilTick ?? 0, match.tick + spell.slowDurationTicks);
    }
    // Glue Freeze gently pulls non-building units toward the cast center, clamped outside both endzones
    if (spell.cardId === "card_glue_freeze" && !target.isBuilding && dist > 1) {
      const pull = 0.25;
      target.x = Math.min(FIELD_WIDTH, Math.max(0, target.x - dx * pull));
      target.y = Math.min(maxSafeY, Math.max(minSafeY, target.y - dy * pull));
    }
  }
}

/** Validates and applies a spawn or spell cast request. Mutates the match on success. */
export function trySpawn(
  match: Match,
  player: PlayerState,
  cardId: unknown,
  x: unknown,
  y: unknown,
): TrySpawnResult {
  if (!inRange(x, FIELD_WIDTH) || !inRange(y, FIELD_HEIGHT)) return { ok: false, reason: "invalid_coordinates" };

  const spell = getSpellStats(cardId);
  const tower = getTowerStats(cardId);
  const unit = getUnitStats(cardId);
  const card = spell ?? tower ?? unit;
  if (!card) return { ok: false, reason: "unknown_card" };
  if (!player.hand.includes(card.cardId)) return { ok: false, reason: "card_not_in_hand" };
  if (player.spawnCooldownTicks > 0) return { ok: false, reason: "cooldown_active", cooldownTicks: player.spawnCooldownTicks };
  if (player.mana < card.cost) return { ok: false, reason: "not_enough_mana", cost: card.cost };

  if (tower && !isInDefensiveZone(player.number, y)) {
    return { ok: false, reason: "outside_defensive_zone" };
  }
  if (unit && !isInHomeEndzone(player.number, y)) {
    return { ok: false, reason: "outside_home_endzone" };
  }

  player.mana -= card.cost;
  player.spawnCooldownTicks = SPAWN_COOLDOWN_TICKS;
  cycleHandCard(player, card.cardId);
  player.playedCardCounts[card.cardId] = (player.playedCardCounts[card.cardId] ?? 0) + 1;

  if (spell) {
    applySpellEffect(match, player, spell, x, y);
    return { ok: true, isSpell: true, spell, x, y, hand: player.hand, drawQueue: player.drawQueue };
  }

  const entity = tower ? addTower(match, player, tower, x, y) : addUnit(match, player, unit!, x, y);
  return { ok: true, isSpell: false, entity, stats: (tower ?? unit)!, hand: player.hand, drawQueue: player.drawQueue };
}

/** Pythagorean distance between two units' centres. */
function distance(a: Entity, b: Entity): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Advances the simulation by one tick:
 *   1. regenerate mana & tick down placement cooldowns
 *   2. targeting: each unit locks onto the nearest reachable enemy within attackRange
 *   3. damage: attacking units hit their target once every attackIntervalTicks;
 *      splash units also hit other enemies within splashRadius of the target
 *   4. remove dead units (health <= 0)
 *   5. move units that aren't attacking; score those reaching the enemy endzone
 *   6. touchdown reset: when a touchdown is scored, reset the field with 5 sticky liquid
 */
export function stepMatch(match: Match): TickEvents {
  const events: TickEvents = { scored: [], engaged: [], hits: [], killed: [], roundReset: false };
  const manaMultiplier = match.overtime ? OVERTIME_MANA_MULTIPLIER : 1;

  for (const p of match.players) {
    p.mana = Math.min(MAX_MANA, p.mana + MANA_PER_TICK * p.modifiers.manaRegen * manaMultiplier);
    if (p.spawnCooldownTicks > 0) p.spawnCooldownTicks--;
  }

  // Decay deployable towers over their lifetime
  for (const unit of match.entities) {
    if (unit.isBuilding && unit.lifetimeTicks && unit.lifetimeTicks > 0 && unit.health > 0) {
      unit.health = Math.max(0, unit.health - unit.maxHealth / unit.lifetimeTicks);
    }
  }

  const isStunned = (u: Entity) => match.tick < (u.stunUntilTick ?? 0);
  const canHit = (attacker: Entity, target: Entity) =>
    !(target.movement === "flying" && attacker.movement !== "flying" && attacker.type !== "Ranged" && attacker.type !== "Caster" && attacker.type !== "Tower");

  // 2. Targeting (plus Magnet Tower taunt tracking)
  const targets = new Map<Entity, Entity>();
  const tauntedBy = new Map<Entity, Entity>();
  for (const unit of match.entities) {
    if (isStunned(unit)) {
      unit.state = "moving";
      unit.targetId = null;
      continue;
    }

    // Check if an enemy Magnet Tower taunts this non-building unit
    if (!unit.isBuilding) {
      let nearestTaunt: Entity | undefined;
      let nearestTauntDist = Infinity;
      for (const other of match.entities) {
        if (other.ownerId === unit.ownerId || !other.tauntRadius || other.health <= 0) continue;
        const d = distance(unit, other);
        if (d <= other.tauntRadius && d < nearestTauntDist) {
          nearestTaunt = other;
          nearestTauntDist = d;
        }
      }
      if (nearestTaunt) {
        tauntedBy.set(unit, nearestTaunt);
      }
    }

    let nearest: Entity | undefined;
    let nearestDist = Infinity;
    for (const other of match.entities) {
      if (other.ownerId === unit.ownerId || other.health <= 0) continue;
      if (!canHit(unit, other)) continue;
      const d = distance(unit, other);
      if (d <= unit.attackRange && d < nearestDist) {
        nearest = other;
        nearestDist = d;
      }
    }

    if (nearest) {
      if (unit.state !== "attacking") {
        events.engaged.push({ attacker: unit, target: nearest, attackerHealth: unit.health, targetHealth: nearest.health });
      }
      unit.state = "attacking";
      unit.targetId = nearest.id;
      targets.set(unit, nearest);
    } else {
      unit.state = "moving";
      unit.targetId = null;
    }
  }

  // 3. Damage
  const applyOnHitSlow = (attacker: Entity, victim: Entity) => {
    if (attacker.applySlowFactor !== undefined && attacker.applySlowDurationTicks) {
      victim.slowFactor = attacker.applySlowFactor;
      victim.slowUntilTick = Math.max(victim.slowUntilTick ?? 0, match.tick + attacker.applySlowDurationTicks);
    }
  };

  for (const unit of match.entities) {
    if (unit.attackCooldown > 0) unit.attackCooldown--;
    if (isStunned(unit)) continue;
    const target = targets.get(unit);
    if (target && unit.attackCooldown === 0) {
      target.health = Math.max(0, target.health - unit.damage);
      applyOnHitSlow(unit, target);
      unit.attackCooldown = unit.attackIntervalTicks;
      unit.lastHitTick = match.tick;
      events.hits.push({ attacker: unit, target, splash: false });

      if (unit.splashRadius > 0) {
        for (const other of match.entities) {
          if (other === target || other.ownerId === unit.ownerId || other.health <= 0) continue;
          if (distance(other, target) <= unit.splashRadius) {
            other.health = Math.max(0, other.health - unit.damage);
            applyOnHitSlow(unit, other);
            events.hits.push({ attacker: unit, target: other, splash: true });
          }
        }
      }
    }
  }

  // 4 + 5. Remove the dead, move the living, score
  const survivors: Entity[] = [];
  for (const unit of match.entities) {
    if (unit.health <= 0) {
      events.killed.push(unit);
      continue;
    }

    const owner = getPlayer(match, unit.ownerId);
    if (!owner) continue; // owner gone; drop the unit

    if (unit.state === "moving" && !unit.isBuilding && unit.speed > 0 && !isStunned(unit)) {
      const slowMult = match.tick < (unit.slowUntilTick ?? 0) ? (unit.slowFactor ?? 1) : 1;
      const effectiveSpeed = unit.speed * slowMult;
      const tauntTower = tauntedBy.get(unit);

      if (tauntTower && tauntTower.health > 0) {
        const dx = tauntTower.x - unit.x;
        const dy = tauntTower.y - unit.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 1e-6) {
          const step = Math.min(effectiveSpeed, dist);
          unit.x += (dx / dist) * step;
          unit.y += (dy / dist) * step;
        }
      } else {
        // Player 1 attacks up the field (y decreases), Player 2 attacks down (y increases)
        unit.y += owner.number === 1 ? -effectiveSpeed : effectiveSpeed;
      }

      if (hasReachedEnemyEndzone(owner.number, unit.y)) {
        owner.score++;
        events.scored.push({ scorer: owner, entity: unit });
        break;
      }
    }
    survivors.push(unit);
  }
  match.entities = survivors;

  // 6. Touchdown round reset: wipe active units, give both players 5 sticky liquid, reset cooldowns
  if (events.scored.length > 0) {
    match.entities = [];
    if (!getScoreLimitWinner(match)) {
      events.roundReset = true;
      for (const p of match.players) {
        p.mana = RESET_MANA_ON_SCORE;
        p.spawnCooldownTicks = SPAWN_COOLDOWN_TICKS;
      }
    }
  }

  return events;
}

/** The player who has reached the winning score (or any lead in sudden-death overtime). */
export function getScoreLimitWinner(match: Match): PlayerState | undefined {
  if (match.overtime) return getLeader(match);
  return match.players.find((p) => p.score >= WINNING_SCORE);
}

/** Higher score wins; equal scores are a draw (undefined). */
export function getLeader(match: Match): PlayerState | undefined {
  const [a, b] = match.players;
  if (a.score === b.score) return undefined;
  return a.score > b.score ? a : b;
}
