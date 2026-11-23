import { create, type StateCreator } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';

export type MatchStatus = 'idle' | 'queued' | 'in_match' | 'ended';
export type MatchMode = 'standard' | 'tournament';
export type PlayerNumber = 1 | 2;

/** A unit on the field, in server world units (see FIELD_WIDTH/FIELD_HEIGHT; y=0 is Player 1's top). */
export interface Entity {
  id: string;
  type: 'Runner';
  ownerId: string; // socket id of the owning player
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  state: 'moving' | 'attacking';
}

export interface RoomPlayer {
  id: string; // socket id
  username: string;
  number: PlayerNumber;
}

export interface Loadout {
  unitIds: string[];
  augmentIds: string[];
}

export interface TournamentInfo {
  id: string;
  name: string;
  units: { id: string; name: string }[];
  augments: { id: string; name: string; rarity: string }[];
}

export interface Score {
  you: number;
  opponent: number;
}

export interface AugmentReward {
  name: string;
  rarity: 'Common' | 'Rare' | 'Legendary';
  effectModifier: number;
  expiresAt: string;
}

/** Sent the instant a match ends ('game_over'). */
export interface GameOverInfo {
  mode: MatchMode;
  result: 'victory' | 'defeat' | 'draw';
  reason: 'score_limit' | 'time_up' | 'forfeit' | 'debug_force_win';
  finalScore: Score;
  opponentName: string;
}

/** Sent once rewards have been written to the database ('match_results'). */
export interface MatchResults {
  result: GameOverInfo['result'];
  rewards: { xpGained: number; totalXp: number; augment: AugmentReward | null } | null;
  rewardsSaved: boolean;
  rewardsError?: string;
}

export interface MatchStartInfo {
  roomID: string;
  mode: MatchMode;
  roomPlayers: RoomPlayer[];
  loadout: Loadout;
  durationMs: number;
}

export interface StateUpdate {
  timeRemainingMs: number;
  mana: number;
  score: Score;
  entities: Entity[];
}

export interface GameState {
  isConnected: boolean;
  localSocketId: string | null; // our socket id; compared against roomPlayers to find our seat
  username: string | null;
  matchStatus: MatchStatus;
  queueMode: MatchMode | null;

  // Current match (from match_found / tournament_match_start)
  roomID: string | null;
  mode: MatchMode | null;
  roomPlayers: RoomPlayer[];
  loadout: Loadout | null;
  tournament: TournamentInfo | null;

  // Live state (from state_update, 30x per second)
  matchTimer: number; // milliseconds remaining
  mana: number; // 0..MAX_MANA, fractional
  score: Score;
  entities: Entity[];

  // Feedback + results
  spawnError: { message: string; at: number } | null;
  gameOver: GameOverInfo | null;
  matchResults: MatchResults | null;

  // Debug: rotate the arena to simulate the other player's camera
  debugFlipView: boolean;

  setConnected: (isConnected: boolean, identity?: { socketId: string; username: string }) => void;
  setQueued: (mode: MatchMode) => void;
  startMatch: (info: MatchStartInfo) => void;
  setTournament: (info: TournamentInfo) => void;
  applyStateUpdate: (update: StateUpdate) => void;
  setSpawnError: (message: string | null) => void;
  setGameOver: (info: GameOverInfo) => void;
  setMatchResults: (results: MatchResults) => void;
  toggleDebugFlipView: () => void;
  reset: () => void;
}

export type GameStore = StoreApi<GameState>;

const initialMatchState = {
  matchStatus: 'idle' as MatchStatus,
  queueMode: null,
  roomID: null,
  mode: null,
  roomPlayers: [] as RoomPlayer[],
  loadout: null,
  tournament: null,
  matchTimer: 0,
  mana: 0,
  score: { you: 0, opponent: 0 },
  entities: [] as Entity[],
  spawnError: null,
  gameOver: null,
  matchResults: null,
};

const gameStateCreator: StateCreator<GameState> = (set) => ({
  isConnected: false,
  localSocketId: null,
  username: null,
  debugFlipView: false,
  ...initialMatchState,

  setConnected: (isConnected, identity) =>
    // Losing the connection drops us from the queue/match on the server, so clear match state too
    set(
      isConnected
        ? { isConnected, localSocketId: identity?.socketId ?? null, username: identity?.username ?? null }
        : { isConnected, localSocketId: null, ...initialMatchState },
    ),
  setQueued: (queueMode) => set({ ...initialMatchState, matchStatus: 'queued', queueMode }),
  startMatch: ({ roomID, mode, roomPlayers, loadout, durationMs }) =>
    set({ ...initialMatchState, matchStatus: 'in_match', roomID, mode, roomPlayers, loadout, matchTimer: durationMs }),
  setTournament: (tournament) => set({ tournament }),
  applyStateUpdate: ({ timeRemainingMs, mana, score, entities }) =>
    set({ matchTimer: timeRemainingMs, mana, score, entities }),
  setSpawnError: (message) => set({ spawnError: message ? { message, at: Date.now() } : null }),
  setGameOver: (gameOver) => set({ matchStatus: 'ended', gameOver, matchResults: null, entities: [], roomID: null }),
  setMatchResults: (matchResults) => set({ matchResults }),
  toggleDebugFlipView: () => set((s) => ({ debugFlipView: !s.debugFlipView })),
  reset: () => set(initialMatchState),
});

/** Our seat in the current room, found by comparing our socket id with the room's players. */
export const selectMe = (s: GameState): RoomPlayer | undefined =>
  s.roomPlayers.find((p) => p.id === s.localSocketId);

export const selectOpponent = (s: GameState): RoomPlayer | undefined =>
  s.roomPlayers.find((p) => p.id !== s.localSocketId);

/** The app's main game store. Usable as a hook (useGameStore(selector)) and as a store (useGameStore.getState()). */
export const useGameStore = create<GameState>()(gameStateCreator);

/** Creates an independent store, e.g. one per simulated client in Debug Mode. */
export const createGameStore = (): GameStore => createStore<GameState>()(gameStateCreator);
