import "dotenv/config";
import express from "express";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { initCronJobs, purgeExpiredAugments } from "./cronJobs";
import { errorSummary, prisma } from "./db";
import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  MATCH_DURATION_MS,
  MAX_CATCH_UP_TICKS,
  SPAWN_COST,
  TICK_MS,
  TICK_RATE,
  WINNING_SCORE,
} from "./game/constants";
import {
  addRunner,
  createMatch,
  getLeader,
  getOpponent,
  getPlayer,
  getScoreLimitWinner,
  stepMatch,
  trySpawn,
  type Entity,
  type Loadout,
  type Match,
  type MatchMode,
  type PlayerState,
  type TickEvents,
} from "./game/match";
import { grantMatchReward, REWARD_PACKAGES, type PlayerReward } from "./game/rewards";
import { getWeeklyTournamentConfig, type WeeklyTournamentConfig } from "./game/tournament";
import { EMPTY_LOADOUT, getMatchLoadout, USERNAME_PATTERN } from "./players";
import { playerRouter } from "./routes/player";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === "production";
// Verbose debug logs: on by default in development, off in production.
// DEBUG_LOGS=true / DEBUG_LOGS=false overrides either way.
const DEBUG_LOGS = process.env.DEBUG_LOGS ? process.env.DEBUG_LOGS === "true" : !IS_PRODUCTION;
const LOADOUT_LOOKUP_TIMEOUT_MS = 2000; // don't let a slow database hold up matchmaking

type GameOverReason = "score_limit" | "time_up" | "forfeit" | "debug_force_win";
type GameResult = "victory" | "defeat" | "draw";

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function debugLog(scope: string, message: string): void {
  if (!DEBUG_LOGS) return;
  const time = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm (UTC)
  console.log(`${time} [${scope}] ${message}`);
}

function formatClock(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(2).padStart(5, "0");
  return `${minutes}:${seconds}`;
}

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T, label: string): Promise<T> {
  return Promise.race([
    promise.catch((err) => {
      console.warn(`[${label}] failed, using fallback:`, errorSummary(err));
      return fallback;
    }),
    new Promise<T>((resolve) =>
      setTimeout(() => {
        resolve(fallback);
      }, ms).unref(),
    ),
  ]);
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());
app.use("/player", playerRouter);

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

// ---------------------------------------------------------------------------
// Matchmaking state (in memory, one server process)
// ---------------------------------------------------------------------------

const queues: Record<MatchMode, string[]> = { standard: [], tournament: [] }; // socket ids, oldest first
const queuedIn = new Map<string, MatchMode>(); // socket id -> which queue it's in
const pairing = new Set<string>(); // sockets paired but waiting for loadouts to load
const matches = new Map<string, Match>(); // matchId -> match
const playerMatch = new Map<string, string>(); // socket id -> matchId

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    queued: { standard: queues.standard.length, tournament: queues.tournament.length },
    activeMatches: matches.size,
  });
});

// ---------------------------------------------------------------------------
// TEMPORARY debug routes. Never registered in production.
// ---------------------------------------------------------------------------

if (!IS_PRODUCTION) {
  // Runs the nightly augment wipe on demand.
  app.get("/debug/trigger-cron", async (_req, res) => {
    try {
      const deleted = await purgeExpiredAugments();
      console.log(`[debug] manual augment wipe: deleted ${deleted}`);
      res.json({ ok: true, job: "purge-expired-augments", deleted, ranAt: new Date().toISOString() });
    } catch (err) {
      console.error("[debug] manual augment wipe failed:", err);
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Drops one Player 1 Runner and one Player 2 Runner facing each other on the
  // same x, 20 units apart (inside attackRange), so combat starts on the next tick.
  // Body (all optional): { matchId, x, p1Y, p2Y }. Defaults to the newest match, mid-field.
  app.post("/debug/spawn-collision", (req, res) => {
    const { matchId, x, p1Y, p2Y } = req.body ?? {};
    const match = typeof matchId === "string" ? matches.get(matchId) : [...matches.values()].at(-1);
    if (!match || match.ended) {
      res.status(404).json({ ok: false, error: matchId ? `No active match ${matchId}` : "No active match" });
      return;
    }

    const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
    const spawnX = num(x, FIELD_WIDTH / 2);
    // Player 1 attacks upward and Player 2 downward, so P1 goes just below P2
    const y1 = num(p1Y, FIELD_HEIGHT / 2 + 10);
    const y2 = num(p2Y, FIELD_HEIGHT / 2 - 10);

    const [p1, p2] = match.players;
    const a = addRunner(match, p1, spawnX, y1);
    const b = addRunner(match, p2, spawnX, y2);
    console.log(`[debug] spawn-collision in ${match.id}: P1 ${a.id} at (${spawnX}, ${y1}) vs P2 ${b.id} at (${spawnX}, ${y2})`);
    res.json({ ok: true, matchId: match.id, entities: [a, b] });
  });
}

// The client sends a username in the handshake (socket.io `auth`). There is no
// login yet, so this is trusted as-is; replace with real authentication before launch.
function resolveUsername(socket: Socket): string {
  const requested = socket.handshake.auth?.username;
  return typeof requested === "string" && USERNAME_PATTERN.test(requested)
    ? requested
    : `Guest-${socket.id.slice(0, 6)}`;
}

function removeFromQueue(socketId: string): boolean {
  const mode = queuedIn.get(socketId);
  if (!mode) return false;
  const q = queues[mode];
  const i = q.indexOf(socketId);
  if (i !== -1) q.splice(i, 1);
  queuedIn.delete(socketId);
  return true;
}

function joinQueue(socket: Socket, mode: MatchMode): void {
  if (playerMatch.has(socket.id) || pairing.has(socket.id)) {
    debugLog("queue", `socket ${socket.id} ${mode} queue rejected: already in a match`);
    socket.emit("queue_error", { message: "Already in a match" });
    return;
  }
  if (queuedIn.has(socket.id)) {
    debugLog("queue", `socket ${socket.id} ${mode} queue rejected: already in ${queuedIn.get(socket.id)} queue`);
    socket.emit("queue_error", { message: "Already in queue" });
    return;
  }

  queues[mode].push(socket.id);
  queuedIn.set(socket.id, mode);
  debugLog("queue", `socket ${socket.id} joined ${mode} queue (position ${queues[mode].length})`);
  socket.emit("queue_joined", { mode, position: queues[mode].length });
  tryPairPlayers(mode);
}

function tryPairPlayers(mode: MatchMode): void {
  const q = queues[mode];
  while (q.length >= 2) {
    const aId = q.shift()!;
    const bId = q.shift()!;
    queuedIn.delete(aId);
    queuedIn.delete(bId);
    const a = io.sockets.sockets.get(aId);
    const b = io.sockets.sockets.get(bId);

    // A socket can vanish between being queued and being paired; requeue the survivor
    if (!a || !b) {
      const survivor = a ?? b;
      if (survivor) {
        q.unshift(survivor.id);
        queuedIn.set(survivor.id, mode);
      }
      debugLog("queue", `pairing skipped a disconnected socket; requeued ${survivor?.id ?? "nobody"}`);
      continue;
    }

    void startMatch(a, b, mode);
  }
}

// ---------------------------------------------------------------------------
// Match lifecycle + authoritative game loop
// ---------------------------------------------------------------------------

/**
 * Standard matches use each player's saved database loadout.
 * Tournament matches ignore saved loadouts and force this week's config on both players.
 */
async function startMatch(a: Socket, b: Socket, mode: MatchMode): Promise<void> {
  pairing.add(a.id);
  pairing.add(b.id);

  let loadoutA: Loadout;
  let loadoutB: Loadout;
  let tournament: WeeklyTournamentConfig | undefined;
  try {
    if (mode === "tournament") {
      tournament = await getWeeklyTournamentConfig();
      loadoutA = tournament.loadout;
      loadoutB = tournament.loadout;
    } else {
      [loadoutA, loadoutB] = await Promise.all(
        [a, b].map((s) =>
          withTimeout(getMatchLoadout(s.data.username), LOADOUT_LOOKUP_TIMEOUT_MS, EMPTY_LOADOUT, `loadout ${s.data.username}`),
        ),
      );
    }
  } finally {
    pairing.delete(a.id);
    pairing.delete(b.id);
  }

  // Someone may have disconnected while loadouts were loading
  const stillA = io.sockets.sockets.get(a.id);
  const stillB = io.sockets.sockets.get(b.id);
  if (!stillA || !stillB) {
    const survivor = stillA ?? stillB;
    debugLog("queue", `opponent left during pairing; requeueing ${survivor?.id ?? "nobody"}`);
    if (survivor) {
      queues[mode].unshift(survivor.id);
      queuedIn.set(survivor.id, mode);
      tryPairPlayers(mode);
    }
    return;
  }

  const matchId = `match_${randomUUID().slice(0, 8)}`;
  const match = createMatch(
    matchId,
    mode,
    { id: a.id, username: a.data.username, loadout: loadoutA },
    { id: b.id, username: b.data.username, loadout: loadoutB },
  );

  a.join(matchId);
  b.join(matchId);
  matches.set(matchId, match);
  playerMatch.set(a.id, matchId);
  playerMatch.set(b.id, matchId);

  const roomPlayers = match.players.map((p) => ({ id: p.id, username: p.username, number: p.number }));
  for (const p of match.players) {
    io.to(p.id).emit("match_found", {
      matchId,
      mode,
      players: roomPlayers, // the client finds itself in here by socket id
      loadout: p.loadout,
      durationMs: MATCH_DURATION_MS,
      tickRate: TICK_RATE,
      winningScore: WINNING_SCORE,
      field: { width: FIELD_WIDTH, height: FIELD_HEIGHT },
    });
    if (tournament) {
      io.to(p.id).emit("tournament_match_start", {
        matchId,
        tournament: { id: tournament.id, name: tournament.name, units: tournament.units, augments: tournament.augments },
      });
    }
    debugLog("room", `socket ${p.id} (${p.username}) placed in room ${matchId} as Player ${p.number}`);
  }

  console.log(`[${matchId}] started (${mode}): ${a.data.username} vs ${b.data.username} (${formatClock(MATCH_DURATION_MS)}, ${TICK_RATE} ticks/s)`);
  const source = tournament ? `WeeklyTournamentConfig "${tournament.id}" (saved loadouts ignored)` : "saved database loadouts";
  console.log(`[${matchId}] loadouts from ${source}:`);
  for (const p of match.players) {
    console.log(`  P${p.number} ${p.username}`);
    console.log(`    units    (${p.loadout.unitIds.length}): ${JSON.stringify(p.loadout.unitIds)}`);
    console.log(`    augments (${p.loadout.augmentIds.length}): ${JSON.stringify(p.loadout.augmentIds)}`);
  }

  match.interval = setInterval(() => runDueTicks(match), TICK_MS);
}

// Timers are coarse (about 15.6ms steps on Windows), so a 33.3ms interval really
// fires every 31-47ms. Each firing runs every tick that is due, which keeps the
// average at exactly TICK_RATE even when individual firings are late.
function runDueTicks(match: Match): void {
  const now = Date.now();
  if (now - match.nextTickAt > MAX_CATCH_UP_TICKS * TICK_MS) {
    match.nextTickAt = now; // stalled (GC pause, sleep): resync instead of bursting
  }
  while (!match.ended && now >= match.nextTickAt) {
    gameTick(match);
    match.nextTickAt += TICK_MS;
  }
}

function gameTick(match: Match): void {
  match.tick++;

  // Mana regen, combat, movement, endzone scoring
  const events = stepMatch(match);
  logTickEvents(match, events);

  // Derive remaining time from the wall clock rather than counting ticks:
  // setInterval drifts, so tick count alone would make the match run long.
  const timeRemainingMs = Math.max(0, match.endsAt - Date.now());

  const recipients = broadcastState(match, timeRemainingMs);

  // Once per second (every TICK_RATE ticks): prove the loop is alive and who it's emitting to
  if (match.tick % TICK_RATE === 0) {
    const [p1, p2] = match.players;
    debugLog(
      match.id,
      `Tick: ${formatClock(timeRemainingMs)} remaining (tick ${match.tick}, state_update -> ${recipients} socket(s), ` +
        `${match.entities.length} entities, score ${p1.score}-${p2.score}, mana ${p1.mana.toFixed(1)}/${p2.mana.toFixed(1)})`,
    );
  }

  if (getScoreLimitWinner(match)) endMatch(match, "score_limit");
  else if (timeRemainingMs === 0) endMatch(match, "time_up");
}

function logTickEvents(match: Match, events: TickEvents): void {
  const [p1, p2] = match.players;
  const ownerNumber = (e: Entity) => getPlayer(match, e.ownerId)?.number;

  // "COMBAT: P1 Health X | P2 Health Y" once per pair: when they first enter
  // range, then on every hit. Both units of a pair usually engage/hit on the
  // same tick, so de-duplicate by pair.
  const logged = new Set<string>();
  const logPair = (a: Entity, aHealth: number, b: Entity, bHealth: number, what: string) => {
    const [u1, h1, u2, h2] = ownerNumber(a) === 1 ? [a, aHealth, b, bHealth] : [b, bHealth, a, aHealth];
    const key = `${u1.id}|${u2.id}|${what}`;
    if (logged.has(key)) return;
    logged.add(key);
    console.log(`[${match.id}] COMBAT: P1 Health ${h1} | P2 Health ${h2}  (${what}: ${u1.id} vs ${u2.id})`);
  };
  for (const e of events.engaged) logPair(e.attacker, e.attackerHealth, e.target, e.targetHealth, "in range");
  for (const { attacker, target } of events.hits) logPair(attacker, attacker.health, target, target.health, "hit");

  for (const unit of events.killed) {
    debugLog(match.id, `${unit.id} (P${ownerNumber(unit)}) destroyed`);
  }
  for (const { scorer, entity } of events.scored) {
    debugLog(match.id, `${scorer.username} scored with ${entity.id} (P1 ${p1.score} - ${p2.score} P2)`);
  }
}

/** Sends each player their own view of the state (own mana, you/opponent score). Returns how many sockets received it. */
function broadcastState(match: Match, timeRemainingMs: number): number {
  // Only what the client needs to draw; combat stats stay on the server
  const entities = match.entities.map((e) => ({
    id: e.id,
    type: e.type,
    ownerId: e.ownerId,
    x: round(e.x, 2),
    y: round(e.y, 2),
    health: e.health,
    maxHealth: e.maxHealth,
    state: e.state,
  }));
  let recipients = 0;

  for (const p of match.players) {
    const socket = io.sockets.sockets.get(p.id);
    if (!socket) continue;
    const opponent = getOpponent(match, p.id)!;
    socket.emit("state_update", {
      matchId: match.id,
      tick: match.tick,
      timeRemainingMs,
      mana: round(p.mana, 2), // opponent's mana is deliberately not sent
      score: { you: p.score, opponent: opponent.score },
      entities,
    });
    recipients++;
  }
  return recipients;
}

/**
 * Stops the loop, frees the players and tells them the result straight away
 * ('game_over'); rewards are written to the database afterwards and sent as
 * 'match_results'.
 */
function endMatch(match: Match, reason: GameOverReason, forfeitedBy?: string): void {
  if (match.ended) return;
  match.ended = true;
  clearInterval(match.interval);
  matches.delete(match.id);

  for (const p of match.players) {
    playerMatch.delete(p.id);
    io.sockets.sockets.get(p.id)?.leave(match.id);
  }

  const winner = forfeitedBy ? getOpponent(match, forfeitedBy) : getLeader(match);
  const [p1, p2] = match.players;
  console.log(
    `[${match.id}] game over: ${reason}, ${winner ? `${winner.username} wins` : "draw"} ` +
      `(P1 ${p1.score} - ${p2.score} P2) after ${match.tick} ticks`,
  );

  const recipients = match.players.filter((p) => p.id !== forfeitedBy);
  for (const p of recipients) {
    const opponent = getOpponent(match, p.id)!;
    io.to(p.id).emit("game_over", {
      matchId: match.id,
      mode: match.mode,
      result: resultFor(p, winner),
      reason,
      finalScore: { you: p.score, opponent: opponent.score },
      opponentName: opponent.username,
    });
  }

  void grantRewards(match, recipients, winner);
}

function resultFor(p: PlayerState, winner: PlayerState | undefined): GameResult {
  return !winner ? "draw" : winner.id === p.id ? "victory" : "defeat";
}

/**
 * Robin Hood rewards: winner gets XP + a Common augment, loser gets 0 XP + a Legendary augment.
 * A draw gives no rewards, and a player who forfeits (disconnects) gets nothing.
 * Emits a personalised 'match_results' to each player still connected.
 */
async function grantRewards(match: Match, recipients: PlayerState[], winner: PlayerState | undefined): Promise<void> {
  await Promise.all(
    recipients.map(async (p) => {
      const result = resultFor(p, winner);

      let rewards: PlayerReward | null = null;
      let rewardsError: string | undefined;
      if (result !== "draw") {
        const pkg = REWARD_PACKAGES[result];
        try {
          rewards = await grantMatchReward(p.username, pkg.xp, pkg.rarity);
          console.log(
            `[rewards] ${p.username} (${result}): +${rewards.xpGained} XP (total ${rewards.totalXp}), ` +
              `${rewards.augment ? `${rewards.augment.rarity} augment "${rewards.augment.name}" until ${rewards.augment.expiresAt}` : `no ${pkg.rarity} augment in catalog`}`,
          );
        } catch (err) {
          rewardsError = "Rewards could not be saved (database unavailable).";
          console.error(`[rewards] failed for ${p.username}:`, errorSummary(err));
        }
      }

      io.to(p.id).emit("match_results", {
        matchId: match.id,
        result,
        rewards,
        rewardsSaved: rewardsError === undefined,
        rewardsError,
      });
    }),
  );
}

// ---------------------------------------------------------------------------
// Socket events
// ---------------------------------------------------------------------------

io.on("connection", (socket) => {
  socket.data.username = resolveUsername(socket);
  debugLog("conn", `socket ${socket.id} (${socket.data.username}) connected (${io.sockets.sockets.size} online)`);

  socket.on("join_queue", () => joinQueue(socket, "standard"));
  socket.on("join_tournament_queue", () => joinQueue(socket, "tournament"));

  socket.on("leave_queue", () => {
    if (removeFromQueue(socket.id)) {
      debugLog("queue", `socket ${socket.id} left queue`);
      socket.emit("queue_left");
    }
  });

  socket.on("spawn_request", (payload: { x?: unknown; y?: unknown } | undefined) => {
    const matchId = playerMatch.get(socket.id);
    const match = matchId ? matches.get(matchId) : undefined;
    const player = match ? getPlayer(match, socket.id) : undefined;
    if (!match || match.ended || !player) {
      socket.emit("spawn_rejected", { reason: "not_in_match" });
      return;
    }

    const result = trySpawn(match, player, payload?.x, payload?.y);
    if (!result.ok) {
      debugLog("spawn", `P${player.number} ${socket.id} rejected: ${result.reason} (mana ${player.mana.toFixed(2)}, x ${String(payload?.x)}, y ${String(payload?.y)})`);
      socket.emit("spawn_rejected", { reason: result.reason, mana: round(player.mana, 2), cost: SPAWN_COST });
      return;
    }

    const { entity } = result;
    debugLog(
      "spawn",
      `P${player.number} ${socket.id} spawned ${entity.id} at (${entity.x.toFixed(1)}, ${entity.y.toFixed(1)}), mana left ${player.mana.toFixed(2)}`,
    );
  });

  // TEMPORARY debug hook: ends the sender's match as a Player 1 win, with real rewards.
  if (!IS_PRODUCTION) {
    socket.on("debug_force_win", () => {
      const matchId = playerMatch.get(socket.id);
      const match = matchId ? matches.get(matchId) : undefined;
      if (!match || match.ended) {
        debugLog("debug", `debug_force_win from ${socket.id} ignored: not in a match`);
        return;
      }
      const [p1] = match.players;
      p1.score = WINNING_SCORE;
      console.log(`[debug] debug_force_win from ${socket.id}: forcing P1 ${p1.username} to ${WINNING_SCORE} in ${match.id}`);
      broadcastState(match, Math.max(0, match.endsAt - Date.now())); // show the final score before game over
      endMatch(match, "debug_force_win");
    });
  }

  socket.on("disconnect", (reason) => {
    debugLog("conn", `socket ${socket.id} disconnected: ${reason} (${io.sockets.sockets.size} online)`);
    if (removeFromQueue(socket.id)) debugLog("queue", `socket ${socket.id} removed from queue on disconnect`);

    const matchId = playerMatch.get(socket.id);
    const match = matchId ? matches.get(matchId) : undefined;
    if (match) endMatch(match, "forfeit", socket.id);
  });
});

// ---------------------------------------------------------------------------
// Startup + shutdown
// ---------------------------------------------------------------------------

const cronTasks = initCronJobs();

httpServer.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} received, shutting down`);
  await Promise.all(cronTasks.map((task) => task.stop()));
  for (const match of matches.values()) clearInterval(match.interval);
  io.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
