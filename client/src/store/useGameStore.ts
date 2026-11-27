import { create, type StateCreator } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { deriveEffects, newEffectId, updateEffects, type Effect } from '../game/effects';

export type MatchStatus = 'idle' | 'queued' | 'in_match' | 'ended';
export type MatchMode = 'standard' | 'tournament';
export type PlayerNumber = 1 | 2;
export type UnitType = 'Melee' | 'Ranged' | 'Tank' | 'Caster';
export type CardType = UnitType | 'Spell' | 'Tower';
export type MovementType = 'walking' | 'running' | 'sliding' | 'flying';

/** A unit or tower on the field, in server world units (see FIELD_WIDTH/FIELD_HEIGHT; y=0 is Player 1's top). */
export interface Entity {
  id: string;
  cardId: string;
  type: UnitType | 'Tower';
  movement?: MovementType;
  ownerId: string; // socket id of the owning player
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  state: 'moving' | 'attacking';
  targetId: string | null;
  lastHitTick: number; // changes each time this unit hits; -1 before its first hit
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

/** A card this player can spawn in the current match (sent in 'match_found'). */
export interface HandCard {
  cardId: string;
  name: string;
  type: CardType;
  movement?: MovementType;
  cost: number;
}

export interface TournamentInfo {
  id: string;
  name: string;
  units: { id: string; name: string }[];
  augments: { id: string; name: string; rarity: string }[];
}

/** Set for practice matches against the computer. */
export interface AiMatchInfo {
  opponent: boolean; // the other seat is the AI
  autoplay: boolean; // the AI is also playing your side (AI vs AI, to watch)
  difficulty?: number; // 1-100 AI difficulty level
}

export interface Score {
  you: number;
  opponent: number;
}

export interface AugmentReward {
  name: string;
  rarity: 'Common' | 'Rare' | 'Legendary';
  effectModifier: number;
  effect?: string | null; // e.g. "+10% unit health"
  expiresAt: string;
}

/** Sent the instant a match ends ('game_over'). */
export interface GameOverInfo {
  mode: MatchMode;
  result: 'victory' | 'defeat' | 'draw';
  reason: 'score_limit' | 'time_up' | 'forfeit' | 'debug_force_win';
  finalScore: Score;
  opponentName: string;
  practice?: boolean; // vs the AI: no rewards
}

export interface TroopXpGain {
  cardId: string;
  name: string;
  xpGained: number;
  totalXp: number;
  previousLevel: number;
  newLevel: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
}

/** Sent once rewards have been written to the database ('match_results'). */
export interface MatchResults {
  result: GameOverInfo['result'];
  rewards: { xpGained: number; totalXp: number; augment: AugmentReward | null } | null;
  troopGains?: TroopXpGain[];
  rewardsSaved: boolean;
  rewardsError?: string;
}

export interface AugmentDraftOption {
  id: string;
  name: string;
  rarity: 'Common' | 'Rare' | 'Legendary';
  stat: string;
  modifier: number;
  effect: string;
}

export interface DraftModalState {
  active: boolean;
  type: 'silver_kickoff' | 'comeback';
  options: AugmentDraftOption[];
}

export interface MatchStartInfo {
  roomID: string;
  mode: MatchMode;
  roomPlayers: RoomPlayer[];
  loadout: Loadout;
  hand: HandCard[];
  nextCard?: HandCard | null;
  opponentPreview?: HandCard[];
  silverDraftOptions?: AugmentDraftOption[];
  kickoffDurationMs?: number;
  boosts: string[];
  ai: AiMatchInfo | null;
  durationMs: number;
}

export interface StateUpdate {
  phase?: 'kickoff' | 'playing' | 'comeback_draft';
  kickoffRemainingMs?: number;
  timeRemainingMs: number;
  overtime?: boolean;
  mana: number;
  score: Score;
  entities: Entity[];
  killed: string[]; // ids of units that died this tick
  spawnCooldownRemainingMs?: number;
  roundReset?: boolean;
}

export interface GameState {
  isConnected: boolean;
  localSocketId: string | null; // our socket id; compared against roomPlayers to find our seat
  username: string | null;
  onlineCount: number | null;
  totalTesters: number | null;
  reconnectInSec: number | null;
  matchStatus: MatchStatus;
  queueMode: MatchMode | null;

  // Current match (from match_found / tournament_match_start)
  roomID: string | null;
  mode: MatchMode | null;
  roomPlayers: RoomPlayer[];
  loadout: Loadout | null;
  hand: HandCard[];
  nextCard: HandCard | null; // the 5th troop in deck waiting to cycle in
  opponentPreview: HandCard[]; // 4 random troops revealed from opponent's deck
  draftModal: DraftModalState | null; // Silver kickoff or Comeback draft modal
  selectedCardId: string | null; // the card a tap in the endzone will spawn
  boosts: string[]; // this player's augment effects for the match, e.g. "+10% unit health"
  ai: AiMatchInfo | null; // practice match vs the computer; kept after game over for "Play Again"
  tournament: TournamentInfo | null;

  // Live state (from state_update, 30x per second)
  phase: 'kickoff' | 'playing' | 'comeback_draft';
  kickoffRemainingMs: number;
  matchTimer: number; // milliseconds remaining
  overtime: boolean;
  mana: number; // 0..MAX_MANA, fractional
  spawnCooldownRemainingMs: number; // 2s placement cooldown remaining
  touchdownBanner: boolean; // displays Touchdown celebration and kickoff reset
  lastTouchdownBy: 'you' | 'opponent' | null; // who scored the most recent touchdown
  score: Score;
  entities: Entity[];
  effects: Effect[]; // short-lived visuals: arrows, damage numbers, falling units

  // Feedback + results
  spawnError: { message: string; at: number } | null;
  gameOver: GameOverInfo | null;
  matchResults: MatchResults | null;

  // Debug: rotate the arena to simulate the other player's camera
  debugFlipView: boolean;

  setConnected: (isConnected: boolean, identity?: { socketId: string; username: string }) => void;
  setOnlineCount: (onlineCount: number, totalTesters?: number | null) => void;
  setReconnectInSec: (reconnectInSec: number | null) => void;
  setQueued: (mode: MatchMode) => void;
  startMatch: (info: MatchStartInfo) => void;
  setHandUpdate: (hand: HandCard[], nextCard: HandCard | null) => void;
  setDraftModal: (modal: DraftModalState | null) => void;
  setBoosts: (boosts: string[]) => void;
  setTournament: (info: TournamentInfo) => void;
  selectCard: (cardId: string) => void;
  applyStateUpdate: (update: StateUpdate) => void;
  addSpellEffect: (spell: { cardId: string; x: number; y: number; radius: number; ownerId: string }) => void;
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
  hand: [] as HandCard[],
  nextCard: null as HandCard | null,
  opponentPreview: [] as HandCard[],
  draftModal: null as DraftModalState | null,
  selectedCardId: null as string | null,
  boosts: [] as string[],
  ai: null as AiMatchInfo | null,
  tournament: null,
  phase: 'playing' as 'kickoff' | 'playing' | 'comeback_draft',
  kickoffRemainingMs: 0,
  matchTimer: 0,
  overtime: false,
  mana: 0,
  spawnCooldownRemainingMs: 0,
  touchdownBanner: false,
  lastTouchdownBy: null as 'you' | 'opponent' | null,
  score: { you: 0, opponent: 0 },
  entities: [] as Entity[],
  effects: [] as Effect[],
  spawnError: null,
  gameOver: null,
  matchResults: null,
};

const gameStateCreator: StateCreator<GameState> = (set) => ({
  isConnected: false,
  localSocketId: null,
  username: null,
  onlineCount: null,
  totalTesters: null,
  reconnectInSec: null,
  debugFlipView: false,
  ...initialMatchState,

  setConnected: (isConnected, identity) =>
    // Losing the connection drops us from the queue/match on the server, so clear match state too
    set(
      isConnected
        ? {
            isConnected,
            localSocketId: identity?.socketId ?? null,
            username: identity?.username ?? null,
            reconnectInSec: null,
          }
        : { isConnected, localSocketId: null, onlineCount: null, totalTesters: null, ...initialMatchState },
    ),
  setOnlineCount: (onlineCount, totalTesters = null) => set({ onlineCount, totalTesters }),
  setReconnectInSec: (reconnectInSec) => set({ reconnectInSec }),
  setQueued: (queueMode) => set({ ...initialMatchState, matchStatus: 'queued', queueMode }),
  startMatch: ({
    roomID,
    mode,
    roomPlayers,
    loadout,
    hand,
    nextCard,
    opponentPreview,
    silverDraftOptions,
    kickoffDurationMs,
    boosts,
    ai,
    durationMs,
  }) =>
    set({
      ...initialMatchState,
      matchStatus: 'in_match',
      roomID,
      mode,
      roomPlayers,
      loadout,
      hand,
      nextCard: nextCard ?? null,
      opponentPreview: opponentPreview ?? [],
      draftModal: silverDraftOptions?.length ? { active: true, type: 'silver_kickoff', options: silverDraftOptions } : null,
      phase: silverDraftOptions?.length ? 'kickoff' : 'playing',
      kickoffRemainingMs: silverDraftOptions?.length ? (kickoffDurationMs ?? 3000) : 0,
      boosts,
      ai,
      selectedCardId: hand[0]?.cardId ?? null,
      matchTimer: durationMs,
    }),
  setHandUpdate: (hand, nextCard) =>
    set((s) => ({
      hand,
      nextCard,
      selectedCardId: s.selectedCardId && hand.some((c) => c.cardId === s.selectedCardId) ? s.selectedCardId : hand[0]?.cardId ?? null,
    })),
  setDraftModal: (draftModal) => set({ draftModal }),
  setBoosts: (boosts) => set({ boosts }),
  setTournament: (tournament) => set({ tournament }),
  selectCard: (selectedCardId) => set({ selectedCardId }),
  applyStateUpdate: ({
    phase,
    kickoffRemainingMs = 0,
    timeRemainingMs,
    overtime = false,
    mana,
    score,
    entities,
    killed,
    spawnCooldownRemainingMs = 0,
    roundReset = false,
  }) =>
    set((s) => {
      const now = Date.now();
      const fresh = roundReset ? [] : deriveEffects(s.entities, entities, killed, now);
      const scorer: 'you' | 'opponent' | null =
        score.you > s.score.you ? 'you' : score.opponent > s.score.opponent ? 'opponent' : s.lastTouchdownBy;
      return {
        phase: phase ?? s.phase,
        kickoffRemainingMs,
        matchTimer: timeRemainingMs,
        overtime,
        mana,
        score,
        entities,
        spawnCooldownRemainingMs,
        touchdownBanner: roundReset ? true : s.touchdownBanner,
        lastTouchdownBy: roundReset ? scorer : s.lastTouchdownBy,
        effects: roundReset ? [] : updateEffects(s.effects, fresh, now),
      };
    }),
  addSpellEffect: (spell) =>
    set((s) => {
      const now = Date.now();
      const effect: Effect = { id: newEffectId('spell'), at: now, kind: 'spell', ...spell };
      return { effects: updateEffects(s.effects, [effect], now) };
    }),
  setSpawnError: (message) => set({ spawnError: message ? { message, at: Date.now() } : null }),
  setGameOver: (gameOver) =>
    set({
      matchStatus: 'ended',
      gameOver,
      matchResults: null,
      entities: [],
      effects: [],
      roomID: null,
      draftModal: null,
      spawnError: null,
      kickoffRemainingMs: 0,
      touchdownBanner: false,
      lastTouchdownBy: null,
    }),
  setMatchResults: (matchResults) => set({ matchResults }),
  toggleDebugFlipView: () => set((s) => ({ debugFlipView: !s.debugFlipView })),
  reset: () => set(initialMatchState),
});

/** Our seat in the current room, found by comparing our socket id with the room's players. */
export const selectMe = (s: GameState): RoomPlayer | undefined =>
  s.roomPlayers.find((p) => p.id === s.localSocketId);

export const selectSelectedCard = (s: GameState): HandCard | undefined =>
  s.hand.find((c) => c.cardId === s.selectedCardId);

export const selectOpponent = (s: GameState): RoomPlayer | undefined =>
  s.roomPlayers.find((p) => p.id !== s.localSocketId);

/** The app's main game store. Usable as a hook (useGameStore(selector)) and as a store (useGameStore.getState()). */
export const useGameStore = create<GameState>()(gameStateCreator);

/** Creates an independent store, e.g. one per simulated client in Debug Mode. */
export const createGameStore = (): GameStore => createStore<GameState>()(gameStateCreator);
