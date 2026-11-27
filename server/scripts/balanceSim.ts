import { botTick, createBot, seededRng, type Rng } from "../src/game/bot";
import { LOADOUT_UNIT_SLOTS, MATCH_DURATION_MS, TICK_MS } from "../src/game/constants";
import { createMatch, getScoreLimitWinner, stepMatch } from "../src/game/match";
import { getCardStats, UNIT_STATS } from "../src/game/units";

interface CardStats {
  cardId: string;
  name: string;
  type: string;
  cost: number;
  appearances: number;
  wins: number;
  losses: number;
  draws: number;
  spawns: number;
  touchdowns: number;
}

function pickRandomDeck(allIds: string[], rng: Rng): string[] {
  const pool = [...allIds];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, LOADOUT_UNIT_SLOTS);
}

function runSimulation(matchCount: number): void {
  const allIds = Object.keys(UNIT_STATS);
  const stats = new Map<string, CardStats>(
    allIds.map((id) => {
      const u = getCardStats(id)!;
      return [
        id,
        {
          cardId: id,
          name: u.name,
          type: u.type,
          cost: u.cost,
          appearances: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          spawns: 0,
          touchdowns: 0,
        },
      ];
    }),
  );

  const rng = seededRng(20261125);
  const maxTicks = Math.ceil(MATCH_DURATION_MS / TICK_MS);
  let totalTicks = 0;
  let totalDraws = 0;
  let totalTouchdowns = 0;

  const startMs = Date.now();

  for (let m = 0; m < matchCount; m++) {
    const deck1 = pickRandomDeck(allIds, rng);
    const deck2 = pickRandomDeck(allIds, rng);
    const match = createMatch(
      `sim_${m}`,
      "standard",
      { id: "p1", username: "SimBot1", loadout: { unitIds: deck1, augmentIds: [] } },
      { id: "p2", username: "SimBot2", loadout: { unitIds: deck2, augmentIds: [] } },
    );
    const bots = [createBot(), createBot()];

    for (let t = 0; t < maxTicks && !getScoreLimitWinner(match); t++) {
      match.tick++;
      match.players.forEach((p, i) => {
        const spawned = botTick(match, p, bots[i], rng);
        if (spawned) {
          const entry = stats.get(spawned.cardId);
          if (entry) entry.spawns++;
        }
      });
      const events = stepMatch(match);
      for (const s of events.scored) {
        totalTouchdowns++;
        const entry = stats.get(s.entity.cardId);
        if (entry) entry.touchdowns++;
      }
    }

    totalTicks += match.tick;
    const [p1, p2] = match.players;
    const winner = getScoreLimitWinner(match) ?? (p1.score > p2.score ? p1 : p2.score > p1.score ? p2 : null);

    if (!winner) totalDraws++;

    const recordDeck = (deck: string[], playerId: string) => {
      for (const id of deck) {
        const s = stats.get(id)!;
        s.appearances++;
        if (!winner) s.draws++;
        else if (winner.id === playerId) s.wins++;
        else s.losses++;
      }
    };
    recordDeck(deck1, p1.id);
    recordDeck(deck2, p2.id);
  }

  const elapsedMs = Date.now() - startMs;
  const ranked = [...stats.values()]
    .map((s) => ({
      ...s,
      winRate: s.appearances > 0 ? ((s.wins + s.draws * 0.5) / s.appearances) * 100 : 0,
    }))
    .sort((a, b) => b.winRate - a.winRate);

  console.log(`\n=== Touchdown PVP Balance Sim (${matchCount} matches in ${elapsedMs}ms) ===`);
  console.log(
    `Avg match: ${((totalTicks / matchCount) * (TICK_MS / 1000)).toFixed(1)}s | Draws: ${totalDraws} (${((totalDraws / matchCount) * 100).toFixed(1)}%) | Total TDs: ${totalTouchdowns}`,
  );

  const printRows = (title: string, rows: typeof ranked) => {
    console.log(`\n${title}`);
    console.log("  Name                   Type     Cost   Apps   Win%   Spawns   TDs");
    for (const r of rows) {
      console.log(
        `  ${r.name.padEnd(22)} ${r.type.padEnd(8)} ${String(r.cost).padStart(4)}   ${String(r.appearances).padStart(4)}  ${r.winRate.toFixed(1).padStart(5)}%  ${String(r.spawns).padStart(6)}  ${String(r.touchdowns).padStart(4)}`,
      );
    }
  };

  printRows("Top 10 Highest Win-Rate (Potential OP):", ranked.slice(0, 10));
  printRows("Bottom 10 Lowest Win-Rate (Potential Underperforming):", [...ranked].reverse().slice(0, 10));
  printRows(
    "Top 5 Touchdown Scorers:",
    [...ranked].sort((a, b) => b.touchdowns - a.touchdowns).slice(0, 5),
  );
}

const count = Number(process.argv[2]) || 400;
runSimulation(count);
