import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { io, type Socket } from 'socket.io-client';

import {
  useGameStore,
  type Entity,
  type GameOverInfo,
  type GameStore,
  type AiMatchInfo,
  type HandCard,
  type Loadout,
  type MatchMode,
  type MatchResults,
  type RoomPlayer,
  type Score,
  type TournamentInfo,
} from '../store/useGameStore';

const SERVER_PORT = 3000;

// "localhost" on a phone or emulator means the phone itself, not your computer.
// In development, Expo knows the LAN address of the machine running Metro
// (hostUri looks like "192.168.1.20:8081"), and the game server runs on that
// same machine, so reuse its host. EXPO_PUBLIC_SERVER_URL overrides this.
export function getServerUrl(): string {
  if (process.env.EXPO_PUBLIC_SERVER_URL) return process.env.EXPO_PUBLIC_SERVER_URL;
  const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
  return `http://${host}:${SERVER_PORT}`;
}

// No accounts yet: each SocketService gets a guest name, saved on the device so
// the same Player row (XP, augments, loadout) is used across app restarts.
function makeGuestName(label: string): string {
  const prefix = label === 'main' ? 'Guest' : label.replace(/[^A-Za-z0-9]/g, '');
  return `${prefix}-${Math.random().toString(36).slice(2, 6)}`;
}

function spawnRejectionText(reason: string, cost?: number): string {
  switch (reason) {
    case 'not_enough_mana':
      return cost ? `Not enough mana (need ${cost})` : 'Not enough mana';
    case 'outside_home_endzone':
      return 'Server: outside your endzone';
    case 'invalid_coordinates':
      return 'Invalid spawn position';
    case 'unknown_card':
    case 'card_not_in_hand':
      return "That card isn't in your hand";
    case 'not_in_match':
      return 'Match is not running';
    default:
      return 'Spawn rejected';
  }
}

interface MatchFoundPayload {
  matchId: string;
  mode: MatchMode;
  players: RoomPlayer[];
  loadout: Loadout;
  hand: HandCard[];
  boosts: string[];
  ai?: AiMatchInfo | null;
  durationMs: number;
}

interface StateUpdatePayload {
  matchId: string;
  tick: number;
  timeRemainingMs: number;
  mana: number;
  score: Score;
  entities: Entity[];
  killed?: string[];
}

/** One Socket.io connection that writes into one game store. Create several to simulate several players. */
export class SocketService {
  private socket: Socket | null = null;
  private wantConnected = false;
  private usernamePromise: Promise<string> | null = null;

  constructor(
    private readonly store: GameStore,
    private readonly label = 'main',
  ) {}

  /** This client's username, created and saved on first use. */
  getUsername(): Promise<string> {
    this.usernamePromise ??= (async () => {
      const key = `touchdown.username.${this.label}`;
      try {
        const saved = await AsyncStorage.getItem(key);
        if (saved) return saved;
      } catch {
        // storage unavailable: fall through to a fresh name for this session
      }
      const name = makeGuestName(this.label);
      try {
        await AsyncStorage.setItem(key, name);
      } catch {
        // not fatal; the name just won't survive a restart
      }
      return name;
    })();
    return this.usernamePromise;
  }

  async connect(): Promise<void> {
    this.wantConnected = true;
    if (this.socket) return;

    const username = await this.getUsername();
    // disconnect() may have been called (screen closed) while the name was loading
    if (!this.wantConnected || this.socket) return;

    const url = getServerUrl();
    console.log(`[socket:${this.label}] connecting to ${url} as ${username}`);

    const socket = io(url, {
      transports: ['websocket'], // the HTTP long-polling fallback is unreliable in React Native
      forceNew: true, // never share a connection with another SocketService, or the server sees one player
      auth: { username },
    });
    this.socket = socket;
    const state = this.store.getState;

    socket.on('connect', () => state().setConnected(true, { socketId: socket.id!, username }));
    socket.on('disconnect', () => state().setConnected(false));
    socket.on('connect_error', (err) => console.warn(`[socket:${this.label}] connect_error: ${err.message}`));

    socket.on('queue_joined', ({ mode }: { mode: MatchMode }) => state().setQueued(mode));
    socket.on('queue_error', ({ message }: { message: string }) =>
      console.warn(`[socket:${this.label}] ${message}`),
    );

    socket.on('match_found', (d: MatchFoundPayload) =>
      state().startMatch({
        roomID: d.matchId,
        mode: d.mode,
        roomPlayers: d.players,
        loadout: d.loadout,
        hand: d.hand ?? [],
        boosts: d.boosts ?? [],
        ai: d.ai ?? null,
        durationMs: d.durationMs,
      }),
    );
    socket.on('tournament_match_start', ({ matchId, tournament }: { matchId: string; tournament: TournamentInfo }) => {
      if (matchId === state().roomID) state().setTournament(tournament);
    });

    socket.on('state_update', ({ matchId, timeRemainingMs, mana, score, entities, killed }: StateUpdatePayload) => {
      // Ignore stray ticks from a match we're no longer in
      if (matchId === state().roomID) state().applyStateUpdate({ timeRemainingMs, mana, score, entities, killed: killed ?? [] });
    });

    socket.on('spawn_rejected', ({ reason, cost }: { reason: string; cost?: number }) =>
      state().setSpawnError(spawnRejectionText(reason, cost)),
    );

    socket.on('game_over', (info: GameOverInfo) => state().setGameOver(info));
    socket.on('match_results', (results: MatchResults) => state().setMatchResults(results));
  }

  disconnect(): void {
    this.wantConnected = false;
    this.socket?.disconnect();
    this.socket = null;
  }

  joinQueue(mode: MatchMode = 'standard'): void {
    this.socket?.emit(mode === 'tournament' ? 'join_tournament_queue' : 'join_queue');
  }

  /** Starts a practice match against the computer. With autoplay, the AI plays your side too. */
  playVsAi(autoplay = false): void {
    this.socket?.emit('join_bot_match', { autoplay });
  }

  leaveQueue(): void {
    this.socket?.emit('leave_queue');
    this.store.getState().reset();
  }

  /** Asks the server to spawn the given card at (x, y) in world units. The server validates the card, mana and position. */
  spawn(cardId: string, x: number, y: number): void {
    this.socket?.emit('spawn_request', { cardId, x, y });
  }

  /** DEBUG: ends the current match as a Player 1 win (server ignores this in production). */
  debugForceWin(): void {
    this.socket?.emit('debug_force_win');
  }
}

/** The app's main connection, backed by the main game store. */
export const socketService = new SocketService(useGameStore);
