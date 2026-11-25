import {
  ENDZONE_DEPTH,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  MANA_PER_TICK,
  MATCH_DURATION_MS,
  MAX_MANA,
  RESET_MANA_ON_SCORE,
  SPAWN_COOLDOWN_TICKS,
  STARTING_MANA,
  TICK_MS,
  WINNING_SCORE,
} from "./constants";
import { combineAugments, type Modifiers } from "./augments";
import { getUnitStats, resolveHand, type MovementType, type UnitStats, type UnitType } from "./units";

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
  type: UnitType;
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
  spawnCooldownTicks: number; // placement cooldown (2s)
  modifiers: Modifiers; // combined augment boosts, applied to every unit this player spawns
}

export interface Match {
  id: string; // also the Socket.io room name
  mode: MatchMode;
  players: [PlayerState, PlayerState];
  entities: Entity[];
  tick: number;
  nextTickAt: number; // epoch ms when the next tick is due
  endsAt: number; // epoch ms
  ended: boolean;
  nextEntityNumber: number;
  interval?: NodeJS.Timeout;
}

export interface MatchSeat {
  id: string;
  username: string;
  loadout: Loadout;
}

export type SpawnRejection =
  | "invalid_coordinates"
  | "unknown_card"
  | "card_not_in_hand"
  | "not_enough_mana"
  | "cooldown_active"
  | "outside_home_endzone";

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
    };
  };
  return {
    id,
    mode,
    players: [player(p1, 1), player(p2, 2)],
    entities: [],
    tick: 0,
    nextTickAt: now + TICK_MS,
    endsAt: now + MATCH_DURATION_MS,
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
  const health = Math.round(stats.health * mods.health);
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
    damage: Math.round(stats.damage * mods.damage),
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

/** Validates and applies a spawn request. Mutates the match on success. */
export function trySpawn(
  match: Match,
  player: PlayerState,
  cardId: unknown,
  x: unknown,
  y: unknown,
): { ok: true; entity: Entity; stats: UnitStats; hand: string[]; drawQueue: string[] } | { ok: false; reason: SpawnRejection; cost?: number; cooldownTicks?: number } {
  if (!inRange(x, FIELD_WIDTH) || !inRange(y, FIELD_HEIGHT)) return { ok: false, reason: "invalid_coordinates" };
  const stats = getUnitStats(cardId);
  if (!stats) return { ok: false, reason: "unknown_card" };
  if (!player.hand.includes(stats.cardId)) return { ok: false, reason: "card_not_in_hand" };
  if (player.spawnCooldownTicks > 0) return { ok: false, reason: "cooldown_active", cooldownTicks: player.spawnCooldownTicks };
  if (player.mana < stats.cost) return { ok: false, reason: "not_enough_mana", cost: stats.cost };
  if (!isInHomeEndzone(player.number, y)) return { ok: false, reason: "outside_home_endzone" };

  player.mana -= stats.cost;
  player.spawnCooldownTicks = SPAWN_COOLDOWN_TICKS;

  // Clash Royale style card recycling: replace card in hand with top card from drawQueue
  if (player.drawQueue.length > 0) {
    const nextCard = player.drawQueue.shift()!;
    const handIndex = player.hand.indexOf(stats.cardId);
    if (handIndex !== -1) {
      player.hand[handIndex] = nextCard;
    } else {
      player.hand.push(nextCard);
    }
    player.drawQueue.push(stats.cardId);
  }

  const entity = addUnit(match, player, stats, x, y);
  return { ok: true, entity, stats, hand: player.hand, drawQueue: player.drawQueue };
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

  for (const p of match.players) {
    p.mana = Math.min(MAX_MANA, p.mana + MANA_PER_TICK * p.modifiers.manaRegen);
    if (p.spawnCooldownTicks > 0) p.spawnCooldownTicks--;
  }

  // 2. Targeting
  const targets = new Map<Entity, Entity>();
  for (const unit of match.entities) {
    let nearest: Entity | undefined;
    let nearestDist = Infinity;
    for (const other of match.entities) {
      if (other.ownerId === unit.ownerId) continue;
      // Ground Melee & Tank units only attack ground troops; Ranged, Caster, and Flying units attack both Air & Ground
      if (other.movement === "flying" && unit.movement !== "flying" && unit.type !== "Ranged" && unit.type !== "Caster") {
        continue;
      }
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
  for (const unit of match.entities) {
    if (unit.attackCooldown > 0) unit.attackCooldown--;
    const target = targets.get(unit);
    if (target && unit.attackCooldown === 0) {
      target.health = Math.max(0, target.health - unit.damage);
      unit.attackCooldown = unit.attackIntervalTicks;
      unit.lastHitTick = match.tick;
      events.hits.push({ attacker: unit, target, splash: false });

      if (unit.splashRadius > 0) {
        for (const other of match.entities) {
          if (other === target || other.ownerId === unit.ownerId) continue;
          if (distance(other, target) <= unit.splashRadius) {
            other.health = Math.max(0, other.health - unit.damage);
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

    if (unit.state === "moving") {
      // Player 1 attacks up the field (y decreases), Player 2 attacks down (y increases)
      unit.y += owner.number === 1 ? -unit.speed : unit.speed;
      if (hasReachedEnemyEndzone(owner.number, unit.y)) {
        owner.score++;
        events.scored.push({ scorer: owner, entity: unit });
        continue;
      }
    }
    survivors.push(unit);
  }
  match.entities = survivors;

  // 6. Touchdown round reset: wipe active units, give both players 5 sticky liquid, reset cooldowns
  if (events.scored.length > 0 && !getScoreLimitWinner(match)) {
    match.entities = [];
    events.roundReset = true;
    for (const p of match.players) {
      p.mana = RESET_MANA_ON_SCORE;
      p.spawnCooldownTicks = 0;
    }
  }

  return events;
}

/** The player who has reached the winning score, if any. */
export function getScoreLimitWinner(match: Match): PlayerState | undefined {
  return match.players.find((p) => p.score >= WINNING_SCORE);
}

/** Higher score wins; equal scores are a draw (undefined). */
export function getLeader(match: Match): PlayerState | undefined {
  const [a, b] = match.players;
  if (a.score === b.score) return undefined;
  return a.score > b.score ? a : b;
}
