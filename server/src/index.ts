import "dotenv/config";
import express from "express";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { initCronJobs, purgeExpiredAugments } from "./cronJobs";
import { errorSummary, prisma } from "./db";
import {
  COMEBACK_DRAFT_TIMEOUT_MS,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  KICKOFF_DRAFT_MS,
  MATCH_DURATION_MS,
  MAX_CATCH_UP_TICKS,
  OVERTIME_DURATION_MS,
  TICK_MS,
  TICK_RATE,
  WINNING_SCORE,
} from "./game/constants";
import {
  addUnit,
  applyAugment,
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
import { grantMatchReward, grantTroopXp, REWARD_PACKAGES, type PlayerReward, type TroopXpGain } from "./game/rewards";
import { getWeeklyTournamentConfig, type WeeklyTournamentConfig } from "./game/tournament";
import { describeModifiers, getDraftOptions } from "./game/augments";
import { getAIBonus } from "./game/ai";
import { botTick, createBot, type BotState } from "./game/bot";
import { DEFAULT_HAND, getUnitStats, handCardInfo, resolveDeck, sampleRandomCards } from "./game/units";
import { EMPTY_LOADOUT, ensurePlayer, getMatchLoadout, getPlayerTroopLevels, USERNAME_PATTERN } from "./players";
import { playerRouter } from "./routes/player";
import { formatInstagramCaption, publishStatsToInstagram, renderInstagramCardSvg } from "./instagram";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// 3100, not 3000: Grafana and many dev tools already default to 3000.
// Keep in sync with SERVER_PORT in client/src/services/SocketService.ts.
const PORT = Number(process.env.PORT) || 3100;
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
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
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
const seenTesters = new Set<string>(); // fallback unique usernames if DB is unavailable
let cachedTotalTesters = 0;
// Practice matches against the computer: matchId -> (player id -> bot brain).
// A bot seat's id is "bot_..." with no socket behind it; with autoplay the
// human's own seat gets a bot brain too, so they can watch AI vs AI.
const matchBots = new Map<string, Map<string, BotState>>();
const matchAiDifficulty = new Map<string, number>();
interface MatchDraftState {
  kickoffEndsAt: number;
  kickoffPending: Map<string, string>; // playerId -> fallback silver augmentId
  comebackPlayerId: string | null;
  comebackDefaultAugmentId: string | null;
  comebackPausedAt: number;
  comebackTimeoutAt: number;
}
const matchDrafts = new Map<string, MatchDraftState>();
const isBotControlled = (match: Match, playerId: string) => matchBots.get(match.id)?.has(playerId) ?? false;
const isBotSeat = (playerId: string) => playerId.startsWith("bot_");

function getOnlinePlayerCount(): number {
  const uniqueUsernames = new Set<string>();
  for (const s of io.sockets.sockets.values()) {
    uniqueUsernames.add(typeof s.data.username === "string" ? s.data.username : s.id);
  }
  return uniqueUsernames.size;
}

function getLiveGameStats() {
  return {
    onlinePlayers: getOnlinePlayerCount(),
    totalTesters: Math.max(cachedTotalTesters, seenTesters.size),
    activeMatches: matches.size,
    updatedAt: new Date().toISOString(),
  };
}

app.get("/health", (_req, res) => {
  const stats = getLiveGameStats();
  res.json({
    ok: true,
    onlinePlayers: stats.onlinePlayers,
    totalTesters: stats.totalTesters,
    queued: { standard: queues.standard.length, tournament: queues.tournament.length },
    activeMatches: stats.activeMatches,
  });
});

app.get("/stats/live", (_req, res) => {
  const stats = getLiveGameStats();
  res.json({ ...stats, caption: formatInstagramCaption(stats) });
});

app.get("/stats/instagram-card.svg", (_req, res) => {
  res.type("image/svg+xml").send(renderInstagramCardSvg(getLiveGameStats()));
});

app.post("/stats/instagram/publish", async (req, res) => {
  const stats = getLiveGameStats();
  const body = (req.body ?? {}) as { imageUrl?: unknown; mediaId?: unknown };
  const result = await publishStatsToInstagram(stats, {
    igUserId: process.env.INSTAGRAM_USER_ID,
    accessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
    imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : process.env.INSTAGRAM_IMAGE_URL,
    mediaId: typeof body.mediaId === "string" ? body.mediaId : process.env.INSTAGRAM_MEDIA_ID,
  });
  res.status(result.ok ? 200 : result.configured ? 502 : 400).json(result);
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

  // Drops one Player 1 unit and one Player 2 unit facing each other on the
  // same x, 20 units apart (inside every unit's attackRange), so combat starts on the next tick.
  // Body (all optional): { matchId, x, p1Y, p2Y, p1CardId, p2CardId }.
  // Defaults to the newest match, mid-field, Footsoldier vs Footsoldier.
  app.post("/debug/spawn-collision", (req, res) => {
    const { matchId, x, p1Y, p2Y, p1CardId, p2CardId } = req.body ?? {};
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

    const fallback = getUnitStats(DEFAULT_HAND[0])!;
    const stats1 = p1CardId === undefined ? fallback : getUnitStats(p1CardId);
    const stats2 = p2CardId === undefined ? fallback : getUnitStats(p2CardId);
    if (!stats1 || !stats2) {
      res.status(400).json({ ok: false, error: "Unknown card id" });
      return;
    }

    const [p1, p2] = match.players;
    const a = addUnit(match, p1, stats1, spawnX, y1);
    const b = addUnit(match, p2, stats2, spawnX, y2);
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

  // Normalize troop levels to Lv. 1 in Ranked 1v1 / Mirror Tournament for fair PvP;
  // players still earn troop XP from every match played.
  const matchId = `match_${randomUUID().slice(0, 8)}`;
  const match = createMatch(
    matchId,
    mode,
    { id: a.id, username: a.data.username, loadout: loadoutA, troopLevels: {} },
    { id: b.id, username: b.data.username, loadout: loadoutB, troopLevels: {} },
  );

  launchMatch(match, [a, b], tournament);
}

/** Registers a created match, tells its human players, and starts the game loop. */
function launchMatch(match: Match, sockets: Socket[], tournament?: WeeklyTournamentConfig): void {
  const matchId = match.id;
  const mode = match.mode;
  for (const s of sockets) {
    s.join(matchId);
    playerMatch.set(s.id, matchId);
  }
  matches.set(matchId, match);

  const kickoffEndsAt = Date.now() + KICKOFF_DRAFT_MS;
  match.phase = "kickoff";
  match.endsAt = kickoffEndsAt + MATCH_DURATION_MS;
  const draftState: MatchDraftState = {
    kickoffEndsAt,
    kickoffPending: new Map(),
    comebackPlayerId: null,
    comebackDefaultAugmentId: null,
    comebackPausedAt: 0,
    comebackTimeoutAt: 0,
  };
  matchDrafts.set(matchId, draftState);

  const roomPlayers = match.players.map((p) => ({ id: p.id, username: p.username, number: p.number }));
  for (const p of match.players) {
    const opponent = getOpponent(match, p.id)!;
    const opponentDeck = resolveDeck(opponent.loadout.unitIds);
    const opponentPreview = sampleRandomCards(opponentDeck, 4).map(handCardInfo);
    const silverDraftOptions = getDraftOptions("silver", 3);

    // Auto-pick for bot players; human players get a 3s kickoff window
    if (isBotControlled(match, p.id)) {
      if (silverDraftOptions.length > 0) applyAugment(p, silverDraftOptions[0].id);
    } else if (silverDraftOptions.length > 0) {
      draftState.kickoffPending.set(p.id, silverDraftOptions[0].id);
    }

    io.to(p.id).emit("match_found", {
      matchId,
      mode,
      players: roomPlayers, // the client finds itself in here by socket id
      loadout: p.loadout,
      hand: p.hand.map(handCardInfo), // the 4 active cards this player can spawn, with costs & movement
      nextCard: p.drawQueue[0] ? handCardInfo(p.drawQueue[0]) : null, // preview of the next card in deck
      opponentPreview, // 4 random cards revealed from opponent's deck
      silverDraftOptions, // 3 Silver augments to choose from before kickoff
      kickoffDurationMs: KICKOFF_DRAFT_MS,
      boosts: describeModifiers(p.modifiers), // e.g. ["+10% unit health"]; opponent's are not sent
      durationMs: MATCH_DURATION_MS,
      tickRate: TICK_RATE,
      winningScore: WINNING_SCORE,
      field: { width: FIELD_WIDTH, height: FIELD_HEIGHT },
      // Practice match info; null in normal matches
      ai: matchBots.has(matchId)
        ? {
            opponent: isBotControlled(match, getOpponent(match, p.id)!.id),
            autoplay: isBotControlled(match, p.id),
            difficulty: matchAiDifficulty.get(matchId),
          }
        : null,
    });
    if (tournament) {
      io.to(p.id).emit("tournament_match_start", {
        matchId,
        tournament: { id: tournament.id, name: tournament.name, units: tournament.units, augments: tournament.augments },
      });
    }
    debugLog("room", `socket ${p.id} (${p.username}) placed in room ${matchId} as Player ${p.number}`);
  }

  const [first, second] = match.players;
  const practice = matchBots.has(matchId) ? ", practice vs AI" : "";
  console.log(
    `[${matchId}] started (${mode}${practice}): ${first.username} vs ${second.username} (${formatClock(MATCH_DURATION_MS)}, ${TICK_RATE} ticks/s)`,
  );
  const source = tournament ? `WeeklyTournamentConfig "${tournament.id}" (saved loadouts ignored)` : "saved database loadouts";
  console.log(`[${matchId}] loadouts from ${source}:`);
  for (const p of match.players) {
    console.log(`  P${p.number} ${p.username}`);
    console.log(`    units    (${p.loadout.unitIds.length}): ${JSON.stringify(p.loadout.unitIds)}`);
    console.log(`    hand     (${p.hand.length}): ${JSON.stringify(p.hand)}`);
    console.log(`    boosts: ${describeModifiers(p.modifiers).join(", ") || "none"}`);
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

function finalizeKickoff(match: Match, draft: MatchDraftState): void {
  for (const [playerId, defaultAugId] of draft.kickoffPending) {
    const p = getPlayer(match, playerId);
    if (p) {
      applyAugment(p, defaultAugId);
      io.to(p.id).emit("draft_confirmed", {
        augmentId: defaultAugId,
        boosts: describeModifiers(p.modifiers),
      });
    }
  }
  draft.kickoffPending.clear();
  match.phase = "playing";
  match.endsAt = Date.now() + MATCH_DURATION_MS;
}

function gameTick(match: Match): void {
  const draft = matchDrafts.get(match.id);
  const now = Date.now();

  // 3-second pre-match kickoff draft window: no troops or bots may deploy yet
  if (match.phase === "kickoff" && draft) {
    if (draft.kickoffPending.size === 0 || now >= draft.kickoffEndsAt) {
      finalizeKickoff(match, draft);
    } else {
      const kickoffRemainingMs = Math.max(0, draft.kickoffEndsAt - now);
      broadcastState(match, MATCH_DURATION_MS, [], false, kickoffRemainingMs);
      return;
    }
  }

  // Mid-round comeback draft pause after conceding a touchdown
  if (match.phase === "comeback_draft" && draft) {
    if (now >= draft.comebackTimeoutAt) {
      const player = draft.comebackPlayerId ? getPlayer(match, draft.comebackPlayerId) : undefined;
      if (player && draft.comebackDefaultAugmentId) {
        applyAugment(player, draft.comebackDefaultAugmentId);
        io.to(player.id).emit("draft_confirmed", {
          augmentId: draft.comebackDefaultAugmentId,
          boosts: describeModifiers(player.modifiers),
        });
      }
      match.endsAt += now - draft.comebackPausedAt;
      draft.comebackPlayerId = null;
      draft.comebackDefaultAugmentId = null;
      match.phase = "playing";
    } else {
      const frozenRemainingMs = Math.max(0, match.endsAt - draft.comebackPausedAt);
      broadcastState(match, frozenRemainingMs);
      return;
    }
  }

  match.tick++;

  // Computer-controlled seats decide before the simulation step, like a spawn_request would
  const bots = matchBots.get(match.id);
  if (bots) {
    for (const p of match.players) {
      const brain = bots.get(p.id);
      const unit =
        brain &&
        botTick(match, p, brain, Math.random, (spell) => {
          io.to(match.id).emit("spell_cast", spell);
          debugLog("bot", `P${p.number} ${p.username} (AI) cast ${spell.cardId} at (${spell.x.toFixed(0)}, ${spell.y.toFixed(0)})`);
        });
      if (unit) debugLog("bot", `P${p.number} ${p.username} (AI) spawned ${unit.cardId} ${unit.id} at x ${unit.x.toFixed(0)}`);
    }
  }

  // Mana regen, combat, movement, endzone scoring
  const events = stepMatch(match);
  logTickEvents(match, events);

  // If a touchdown occurred, trigger comeback draft strictly for the conceding player
  if (events.roundReset && events.scored.length > 0 && !getScoreLimitWinner(match)) {
    const scorer = events.scored[0].scorer;
    const conceding = getOpponent(match, scorer.id);
    if (conceding) {
      const comebackOptions = getDraftOptions("gold_or_legendary", 3);
      debugLog(match.id, `Touchdown comeback draft offered to P${conceding.number} ${conceding.username}`);
      const socket = io.sockets.sockets.get(conceding.id);
      if (socket && comebackOptions.length > 0) {
        if (draft) {
          match.phase = "comeback_draft";
          draft.comebackPlayerId = conceding.id;
          draft.comebackDefaultAugmentId = comebackOptions[0].id;
          draft.comebackPausedAt = now;
          draft.comebackTimeoutAt = now + COMEBACK_DRAFT_TIMEOUT_MS;
        }
        socket.emit("comeback_draft", {
          options: comebackOptions,
          reason: "conceded_touchdown",
        });
      } else if (isBotControlled(match, conceding.id) && comebackOptions.length > 0) {
        applyAugment(conceding, comebackOptions[0].id);
        debugLog(match.id, `Bot P${conceding.number} auto-picked comeback augment ${comebackOptions[0].name}`);
      }
    }
  }

  // Derive remaining time from the wall clock rather than counting ticks:
  // setInterval drifts, so tick count alone would make the match run long.
  let timeRemainingMs = Math.max(0, match.endsAt - Date.now());
  const [p1, p2] = match.players;
  if (timeRemainingMs === 0 && p1.score === p2.score && !match.overtime && !getScoreLimitWinner(match)) {
    match.overtime = true;
    match.endsAt = Date.now() + OVERTIME_DURATION_MS;
    timeRemainingMs = OVERTIME_DURATION_MS;
    debugLog(match.id, `Sudden-Death Overtime started! Score tied ${p1.score}-${p2.score}`);
  }

  const recipients = broadcastState(match, timeRemainingMs, events.killed.map((e) => e.id), events.roundReset);

  // Once per second (every TICK_RATE ticks): prove the loop is alive and who it's emitting to
  if (match.tick % TICK_RATE === 0) {
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
function broadcastState(
  match: Match,
  timeRemainingMs: number,
  killedIds: string[] = [],
  roundReset = false,
  kickoffRemainingMs = 0,
): number {
  // Only what the client needs to draw; combat stats stay on the server
  const entities = match.entities.map((e) => ({
    id: e.id,
    cardId: e.cardId,
    type: e.type,
    movement: e.movement,
    ownerId: e.ownerId,
    x: round(e.x, 2),
    y: round(e.y, 2),
    health: e.health,
    maxHealth: e.maxHealth,
    state: e.state,
    targetId: e.targetId,
    lastHitTick: e.lastHitTick, // changes on every hit, so the client can play the swing
  }));
  let recipients = 0;

  for (const p of match.players) {
    const socket = io.sockets.sockets.get(p.id);
    if (!socket) continue;
    const opponent = getOpponent(match, p.id)!;
    socket.emit("state_update", {
      matchId: match.id,
      tick: match.tick,
      phase: match.phase,
      kickoffRemainingMs,
      timeRemainingMs,
      overtime: Boolean(match.overtime),
      mana: round(p.mana, 2), // opponent's mana is deliberately not sent
      spawnCooldownRemainingMs: Math.max(0, Math.ceil((p.spawnCooldownTicks / TICK_RATE) * 1000)),
      roundReset,
      score: { you: p.score, opponent: opponent.score },
      entities,
      killed: killedIds, // units that died this tick (the rest that vanished scored)
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
  const practice = matchBots.delete(match.id);
  matchAiDifficulty.delete(match.id);
  matchDrafts.delete(match.id);

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

  // Bot seats have no socket and no account, so they get neither results nor rewards
  const recipients = match.players.filter((p) => p.id !== forfeitedBy && !isBotSeat(p.id));
  for (const p of recipients) {
    const opponent = getOpponent(match, p.id)!;
    io.to(p.id).emit("game_over", {
      matchId: match.id,
      mode: match.mode,
      result: resultFor(p, winner),
      reason,
      finalScore: { you: p.score, opponent: opponent.score },
      opponentName: opponent.username,
      practice, // practice matches vs the AI give no rewards
    });
  }

  if (practice) {
    void grantPracticeTroopXp(match, recipients, winner);
    return;
  }

  void grantRewards(match, recipients, winner);
}

async function grantPracticeTroopXp(match: Match, recipients: PlayerState[], winner: PlayerState | undefined): Promise<void> {
  const durationSeconds = Math.max(1, Math.round(match.tick / TICK_RATE));
  await Promise.all(
    recipients.map(async (p) => {
      const playedIds = Object.keys(p.playedCardCounts);
      let troopGains: TroopXpGain[] = [];
      if (playedIds.length > 0) {
        try {
          troopGains = await grantTroopXp(p.username, playedIds, durationSeconds);
        } catch (err) {
          console.error(`[troopXp] failed for ${p.username}:`, errorSummary(err));
        }
      }
      io.to(p.id).emit("match_results", {
        matchId: match.id,
        result: resultFor(p, winner),
        rewards: null,
        troopGains,
        rewardsSaved: true,
      });
    }),
  );
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
  const durationSeconds = Math.max(1, Math.round(match.tick / TICK_RATE));
  await Promise.all(
    recipients.map(async (p) => {
      const result = resultFor(p, winner);

      let rewards: PlayerReward | null = null;
      let troopGains: TroopXpGain[] = [];
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

      const playedIds = Object.keys(p.playedCardCounts);
      if (playedIds.length > 0) {
        try {
          troopGains = await grantTroopXp(p.username, playedIds, durationSeconds);
        } catch (err) {
          console.error(`[troopXp] failed for ${p.username}:`, errorSummary(err));
        }
      }

      io.to(p.id).emit("match_results", {
        matchId: match.id,
        result,
        rewards,
        troopGains,
        rewardsSaved: rewardsError === undefined,
        rewardsError,
      });
    }),
  );
}

/**
 * A practice match against the computer, starting straight away. The player
 * uses their saved deck; the bot uses the starter hand with no augments.
 * With autoplay, a bot plays the player's side as well (AI vs AI to watch).
 */
async function startBotMatch(socket: Socket, autoplay: boolean, difficulty?: number): Promise<void> {
  if (playerMatch.has(socket.id) || pairing.has(socket.id) || queuedIn.has(socket.id)) {
    socket.emit("queue_error", { message: "Already in a match or queue" });
    return;
  }

  pairing.add(socket.id);
  let loadout: Loadout;
  try {
    loadout = await withTimeout(
      getMatchLoadout(socket.data.username),
      LOADOUT_LOOKUP_TIMEOUT_MS,
      EMPTY_LOADOUT,
      `loadout ${socket.data.username}`,
    );
  } finally {
    pairing.delete(socket.id);
  }
  if (!io.sockets.sockets.get(socket.id)) return; // left while the deck was loading

  const level =
    typeof difficulty === "number" && Number.isFinite(difficulty)
      ? Math.round(Math.min(100, Math.max(1, difficulty)))
      : undefined;

  const troopLevels = await withTimeout(
    getPlayerTroopLevels(socket.data.username),
    LOADOUT_LOOKUP_TIMEOUT_MS,
    {},
    `troopLevels ${socket.data.username}`,
  );

  const matchId = `match_${randomUUID().slice(0, 8)}`;
  const botId = `bot_${randomUUID().slice(0, 8)}`;
  const botName = level !== undefined ? `AI Bot (Lv.${level})` : "AI Bot";
  const match = createMatch(
    matchId,
    "standard",
    { id: socket.id, username: socket.data.username, loadout, troopLevels },
    { id: botId, username: botName, loadout: EMPTY_LOADOUT },
  );

  if (level !== undefined) {
    matchAiDifficulty.set(matchId, level);
    const bonus = getAIBonus(level);
    const [humanPlayer, botPlayer] = match.players;
    botPlayer.mana = bonus.startingLiquid;
    botPlayer.modifiers.manaRegen *= bonus.manaRegenMultiplier;
    if (!autoplay) {
      humanPlayer.modifiers.damage *= 1 - bonus.damageDebuff;
    }
  }

  const brains = new Map<string, BotState>([[botId, createBot(level)]]);
  if (autoplay) brains.set(socket.id, createBot());
  matchBots.set(matchId, brains);

  launchMatch(match, [socket]);
}

// ---------------------------------------------------------------------------
// Socket events
// ---------------------------------------------------------------------------

function broadcastOnlineCount(): void {
  io.emit("online_count", {
    count: getOnlinePlayerCount(),
    totalTesters: Math.max(cachedTotalTesters, seenTesters.size),
  });
}

async function refreshTotalTesters(username: string): Promise<void> {
  seenTesters.add(username);
  try {
    await ensurePlayer(username);
    cachedTotalTesters = await prisma.player.count();
  } catch {
    // DB unavailable; fall back to in-memory unique usernames
  }
  broadcastOnlineCount();
}

io.on("connection", (socket) => {
  socket.data.username = resolveUsername(socket);
  debugLog("conn", `socket ${socket.id} (${socket.data.username}) connected (${io.sockets.sockets.size} online)`);
  broadcastOnlineCount();
  void refreshTotalTesters(socket.data.username);

  socket.on("join_queue", () => joinQueue(socket, "standard"));
  socket.on("join_tournament_queue", () => joinQueue(socket, "tournament"));
  socket.on("join_bot_match", (payload: { autoplay?: unknown; difficulty?: unknown } | undefined) => {
    const difficulty = typeof payload?.difficulty === "number" ? payload.difficulty : undefined;
    void startBotMatch(socket, payload?.autoplay === true, difficulty);
  });

  socket.on("leave_queue", () => {
    if (removeFromQueue(socket.id)) {
      debugLog("queue", `socket ${socket.id} left queue`);
      socket.emit("queue_left");
    }
  });

  socket.on("spawn_request", (payload: { cardId?: unknown; x?: unknown; y?: unknown } | undefined) => {
    const matchId = playerMatch.get(socket.id);
    const match = matchId ? matches.get(matchId) : undefined;
    const player = match ? getPlayer(match, socket.id) : undefined;
    if (!match || match.ended || !player) {
      socket.emit("spawn_rejected", { reason: "not_in_match" });
      return;
    }
    if (match.phase !== "playing") {
      socket.emit("spawn_rejected", {
        reason: match.phase === "kickoff" ? "kickoff_active" : "draft_active",
      });
      return;
    }

    const result = trySpawn(match, player, payload?.cardId, payload?.x, payload?.y);
    if (!result.ok) {
      debugLog(
        "spawn",
        `P${player.number} ${socket.id} rejected: ${result.reason} (card ${String(payload?.cardId)}, mana ${player.mana.toFixed(2)}, ` +
          `x ${String(payload?.x)}, y ${String(payload?.y)})`,
      );
      socket.emit("spawn_rejected", {
        reason: result.reason,
        mana: round(player.mana, 2),
        cost: result.cost,
        cooldownRemainingMs: result.cooldownTicks ? Math.ceil((result.cooldownTicks / TICK_RATE) * 1000) : 0,
      });
      return;
    }

    const { hand, drawQueue } = result;
    // Tell player their new hand rotation (Clash Royale cycle)
    socket.emit("hand_update", {
      hand: hand.map(handCardInfo),
      nextCard: drawQueue[0] ? handCardInfo(drawQueue[0]) : null,
    });
    if (result.isSpell) {
      io.to(match.id).emit("spell_cast", {
        cardId: result.spell.cardId,
        x: result.x,
        y: result.y,
        radius: result.spell.radius,
        ownerId: player.id,
      });
      debugLog(
        "spawn",
        `P${player.number} ${socket.id} cast ${result.spell.name} for ${result.spell.cost} mana at (${result.x.toFixed(1)}, ${result.y.toFixed(1)}), mana left ${player.mana.toFixed(2)}`,
      );
      return;
    }

    const { entity, stats } = result;
    debugLog(
      "spawn",
      `P${player.number} ${socket.id} spawned ${stats.name} ${entity.id} for ${stats.cost} mana at (${entity.x.toFixed(1)}, ${entity.y.toFixed(1)}), mana left ${player.mana.toFixed(2)}`,
    );
  });

  socket.on("draft_pick", ({ augmentId }: { augmentId?: unknown }) => {
    const matchId = playerMatch.get(socket.id);
    const match = matchId ? matches.get(matchId) : undefined;
    const player = match ? getPlayer(match, socket.id) : undefined;
    const draft = match ? matchDrafts.get(match.id) : undefined;
    if (!match || match.ended || !player || typeof augmentId !== "string") return;
    if (match.phase !== "kickoff" || !draft?.kickoffPending.has(player.id)) return;

    applyAugment(player, augmentId);
    draft.kickoffPending.delete(player.id);
    socket.emit("draft_confirmed", {
      augmentId,
      boosts: describeModifiers(player.modifiers),
    });
    debugLog("draft", `P${player.number} ${player.username} picked Silver augment ${augmentId}`);

    if (draft.kickoffPending.size === 0) {
      finalizeKickoff(match, draft);
      broadcastState(match, MATCH_DURATION_MS);
    }
  });

  socket.on("comeback_pick", ({ augmentId }: { augmentId?: unknown }) => {
    const matchId = playerMatch.get(socket.id);
    const match = matchId ? matches.get(matchId) : undefined;
    const player = match ? getPlayer(match, socket.id) : undefined;
    const draft = match ? matchDrafts.get(match.id) : undefined;
    if (!match || match.ended || !player || typeof augmentId !== "string") return;
    if (match.phase !== "comeback_draft" || !draft || draft.comebackPlayerId !== player.id) return;

    applyAugment(player, augmentId);
    match.endsAt += Date.now() - draft.comebackPausedAt;
    draft.comebackPlayerId = null;
    draft.comebackDefaultAugmentId = null;
    match.phase = "playing";
    match.nextTickAt = Date.now();

    socket.emit("draft_confirmed", {
      augmentId,
      boosts: describeModifiers(player.modifiers),
    });
    broadcastState(match, Math.max(0, match.endsAt - Date.now()));
    debugLog("draft", `P${player.number} ${player.username} picked Comeback augment ${augmentId}`);
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
    broadcastOnlineCount();
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
