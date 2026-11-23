import { ENDZONE_DEPTH, FIELD_HEIGHT, FIELD_WIDTH, TICK_RATE } from "./constants";
import { trySpawn, type Entity, type Match, type PlayerState } from "./match";
import { getUnitStats } from "./units";

// A simple computer opponent for testing. It plays through trySpawn, so it
// follows exactly the same rules (hand, mana, endzone) as a human player.
//
// Each "think" (every 0.4-1s) it:
//   1. defends: if an enemy is closing in on its endzone, it drops a counter
//      in that lane (archer vs tank, battle mage vs a group, tank otherwise)
//   2. attacks: otherwise it saves up and sends a Shield Bearer with an
//      Archer behind it, or something cheap down a random lane

export type Rng = () => number; // 0 <= n < 1

export interface BotState {
  nextThinkTick: number;
  followUp: { cardId: string; x: number } | null; // e.g. an archer to go behind a tank
}

const THREAT_DISTANCE = 300; // world units from the bot's own goal line
const GROUP_RADIUS = 60;
const LANES = [60, 180, 300];
const ATTACK_MANA = 7; // what the bot saves up to before a big push

export function createBot(): BotState {
  return { nextThinkTick: TICK_RATE, followUp: null };
}

/** Called once per tick for a bot-controlled player. Returns the unit it spawned, if any. */
export function botTick(match: Match, player: PlayerState, bot: BotState, rng: Rng = Math.random): Entity | null {
  if (match.tick < bot.nextThinkTick) return null;
  bot.nextThinkTick = match.tick + Math.round(TICK_RATE * (0.4 + rng() * 0.6));

  const enemies = match.entities.filter((e) => e.ownerId !== player.id);

  // 1. Defend
  const threats = enemies
    .filter((e) => distanceToGoal(player, e.y) < THREAT_DISTANCE)
    .sort((a, b) => distanceToGoal(player, a.y) - distanceToGoal(player, b.y));
  if (threats.length) {
    const nearest = threats[0];
    const grouped = threats.filter((t) => Math.hypot(t.x - nearest.x, t.y - nearest.y) <= GROUP_RADIUS).length >= 2;
    const counters =
      grouped ? ["card_battle_mage", "card_shield_bearer", "card_footsoldier"]
      : nearest.type === "Tank" ? ["card_archer", "card_battle_mage", "card_footsoldier"]
      : nearest.type === "Ranged" ? ["card_footsoldier", "card_shield_bearer"]
      : ["card_shield_bearer", "card_archer", "card_footsoldier"];
    // Only defend with what it can afford right now; otherwise wait for mana
    return spawnFirst(match, player, counters, nearest.x, rng);
  }

  // 2. Attack
  if (bot.followUp) {
    const { cardId, x } = bot.followUp;
    const unit = spawnFirst(match, player, [cardId], x, rng);
    if (unit) bot.followUp = null;
    return unit;
  }
  if (player.mana >= ATTACK_MANA) {
    const lane = LANES[Math.floor(rng() * LANES.length)];
    const tank = spawnFirst(match, player, ["card_shield_bearer"], lane, rng);
    if (tank) {
      bot.followUp = { cardId: "card_archer", x: lane };
      return tank;
    }
  }
  // Now and then, poke with something cheap instead of saving
  if (rng() < 0.2) {
    const cheap = player.hand.filter((id) => (getUnitStats(id)?.cost ?? Infinity) <= 2);
    const lane = LANES[Math.floor(rng() * LANES.length)];
    return spawnFirst(match, player, shuffle(cheap, rng), lane, rng);
  }
  return null;
}

/** How far a y position is from this player's own goal line (0 = at the line). */
function distanceToGoal(player: PlayerState, y: number): number {
  return player.number === 1 ? FIELD_HEIGHT - ENDZONE_DEPTH - y : y - ENDZONE_DEPTH;
}

/** Spawns the first card in `cardIds` that's in the hand and affordable, near lane x. */
function spawnFirst(match: Match, player: PlayerState, cardIds: string[], x: number, rng: Rng): Entity | null {
  const y = player.number === 1 ? FIELD_HEIGHT - ENDZONE_DEPTH / 2 : ENDZONE_DEPTH / 2;
  const spawnX = Math.min(FIELD_WIDTH - 20, Math.max(20, x + (rng() - 0.5) * 30));
  for (const cardId of cardIds) {
    if (!player.hand.includes(cardId)) continue;
    const result = trySpawn(match, player, cardId, spawnX, y);
    if (result.ok) return result.entity;
  }
  return null;
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Small seeded random generator, so bot tests are repeatable. */
export function seededRng(seed: number): Rng {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
