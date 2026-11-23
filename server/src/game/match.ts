import {
  ATTACK_INTERVAL_TICKS,
  ENDZONE_DEPTH,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  MANA_PER_TICK,
  MATCH_DURATION_MS,
  MAX_MANA,
  RUNNER_SPEED,
  SPAWN_COST,
  STARTING_MANA,
  TICK_MS,
  UNIT_ATTACK_RANGE,
  UNIT_DAMAGE,
  UNIT_HEALTH,
  WINNING_SCORE,
} from "./constants";

// Pure match state + rules. No sockets or timers here, so it can be tested on its own.

export type PlayerNumber = 1 | 2;
export type MatchMode = "standard" | "tournament";

export interface Loadout {
  unitIds: string[]; // Card ids
  augmentIds: string[]; // Augment ids
}

export interface Entity {
  id: string;
  type: "Runner";
  ownerId: string; // socket id of the player who spawned it
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  damage: number;
  attackRange: number;
  state: "moving" | "attacking";
  targetId: string | null;
  attackCooldown: number; // ticks until this unit may hit again
}

export interface PlayerState {
  id: string; // socket id
  username: string;
  number: PlayerNumber; // 1 starts at the bottom and attacks upward, 2 the reverse
  mana: number; // fractional; regenerates every tick
  score: number;
  loadout: Loadout;
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

export type SpawnRejection = "invalid_coordinates" | "not_enough_mana" | "outside_home_endzone";

/** Things that happened during a tick, for logging. */
export interface TickEvents {
  scored: { scorer: PlayerState; entity: Entity }[];
  // A unit started attacking this tick; health is captured before this tick's damage
  engaged: { attacker: Entity; target: Entity; attackerHealth: number; targetHealth: number }[];
  hits: { attacker: Entity; target: Entity }[];
  killed: Entity[];
}

export function createMatch(id: string, mode: MatchMode, p1: MatchSeat, p2: MatchSeat): Match {
  const now = Date.now();
  const player = (seat: MatchSeat, number: PlayerNumber): PlayerState => ({
    ...seat,
    number,
    mana: STARTING_MANA,
    score: 0,
  });
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

/** Creates a Runner owned by `player` and adds it to the field. No validation; see trySpawn. */
export function addRunner(match: Match, player: PlayerState, x: number, y: number): Entity {
  const entity: Entity = {
    id: `runner_${match.nextEntityNumber++}`,
    type: "Runner",
    ownerId: player.id,
    x,
    y,
    health: UNIT_HEALTH,
    maxHealth: UNIT_HEALTH,
    damage: UNIT_DAMAGE,
    attackRange: UNIT_ATTACK_RANGE,
    state: "moving",
    targetId: null,
    attackCooldown: 0,
  };
  match.entities.push(entity);
  return entity;
}

/** Validates and applies a spawn request. Mutates the match on success. */
export function trySpawn(
  match: Match,
  player: PlayerState,
  x: unknown,
  y: unknown,
): { ok: true; entity: Entity } | { ok: false; reason: SpawnRejection } {
  if (!inRange(x, FIELD_WIDTH) || !inRange(y, FIELD_HEIGHT)) return { ok: false, reason: "invalid_coordinates" };
  if (player.mana < SPAWN_COST) return { ok: false, reason: "not_enough_mana" };
  if (!isInHomeEndzone(player.number, y)) return { ok: false, reason: "outside_home_endzone" };

  player.mana -= SPAWN_COST;
  return { ok: true, entity: addRunner(match, player, x, y) };
}

/** Pythagorean distance between two units' centres. */
function distance(a: Entity, b: Entity): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Advances the simulation by one tick:
 *   1. regenerate mana
 *   2. targeting: each unit locks onto the nearest enemy within its attackRange
 *   3. damage: attacking units hit their target once every ATTACK_INTERVAL_TICKS
 *   4. remove dead units (health <= 0)
 *   5. move units that aren't attacking; score those reaching the enemy endzone
 * Targeting and damage both read positions/health from the start of the tick,
 * so two units that kill each other on the same tick both die (no first-mover advantage).
 */
export function stepMatch(match: Match): TickEvents {
  const events: TickEvents = { scored: [], engaged: [], hits: [], killed: [] };

  for (const p of match.players) p.mana = Math.min(MAX_MANA, p.mana + MANA_PER_TICK);

  // 2. Targeting
  const targets = new Map<Entity, Entity>();
  for (const unit of match.entities) {
    let nearest: Entity | undefined;
    let nearestDist = Infinity;
    for (const other of match.entities) {
      if (other.ownerId === unit.ownerId) continue;
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
      unit.attackCooldown = ATTACK_INTERVAL_TICKS;
      events.hits.push({ attacker: unit, target });
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
      unit.y += owner.number === 1 ? -RUNNER_SPEED : RUNNER_SPEED;
      if (hasReachedEnemyEndzone(owner.number, unit.y)) {
        owner.score++;
        events.scored.push({ scorer: owner, entity: unit });
        continue;
      }
    }
    survivors.push(unit);
  }
  match.entities = survivors;

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
