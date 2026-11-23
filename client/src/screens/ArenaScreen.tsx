import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { useStore } from 'zustand';

import { EntitySquare } from '../components/EntitySquare';
import { ENDZONE_DEPTH, FIELD_HEIGHT, FIELD_WIDTH, MAX_MANA, SPAWN_COST } from '../game/constants';
import type { SocketService } from '../services/SocketService';
import { selectMe, selectOpponent, type GameStore } from '../store/useGameStore';

const COLORS = {
  field: '#2f8f3a',
  fieldLine: 'rgba(255,255,255,0.25)',
  homeEndzone: '#8fd3ff', // light blue
  enemyEndzone: '#ff9a9a', // light red
  myUnit: '#1f5fff', // blue
  enemyUnit: '#e0262b', // red
  mana: '#b14cff',
};

const ENDZONE_PCT = `${(ENDZONE_DEPTH / FIELD_HEIGHT) * 100}%` as const;

function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  return `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, '0')}`;
}

interface Props {
  store: GameStore;
  service: SocketService;
  compact?: boolean;
}

/**
 * The board is drawn in server world coordinates (Player 1's point of view:
 * Player 1's endzone at the bottom). For Player 2 the whole board View is
 * rotated 180° so their own endzone ends up at the bottom of their screen.
 *
 * Touches are handled by an UNROTATED wrapper the same size as the board, so
 * tap coordinates always arrive in screen space; for a flipped view they are
 * then rotated back into world space before being sent to the server.
 */
export function ArenaScreen({ store, service, compact = false }: Props) {
  const [area, setArea] = useState({ width: 0, height: 0 });

  // Which seat are we? Compare our local socket id with the room's player list.
  const myNumber = useStore(store, (s) => selectMe(s)?.number ?? null);
  const debugFlipView = useStore(store, (s) => s.debugFlipView);
  const isPlayerTwo = myNumber === 2;
  // The debug toggle inverts the natural view, e.g. shows Player 1 what Player 2 sees
  const flipped = isPlayerTwo !== debugFlipView;
  const viewAs = flipped ? 2 : 1; // whose home endzone is at the bottom of the screen

  // Largest 9:16 board that fits the space we're given (keeps distances true to the server's)
  const scale = area.width && area.height ? Math.min(area.width / FIELD_WIDTH, area.height / FIELD_HEIGHT) : 0;
  const boardWidth = FIELD_WIDTH * scale;
  const boardHeight = FIELD_HEIGHT * scale;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea({ width, height });
  };

  const onPressIn = (e: GestureResponderEvent) => {
    if (!scale) return;
    // Every child of the wrapper has pointerEvents 'none', so locationX/Y are relative
    // to the unrotated wrapper: plain screen-space pixels within the board.
    const { locationX, locationY } = e.nativeEvent;
    const screenX = locationX / scale; // in world units, but as seen on screen
    const screenY = locationY / scale;

    // Undo the 180° rotation: a point at (x, y) on screen is at (W - x, H - y) on the board
    const worldX = flipped ? FIELD_WIDTH - screenX : screenX;
    const worldY = flipped ? FIELD_HEIGHT - screenY : screenY;

    const tag = `[arena${compact ? ':debug' : ''}] P${myNumber ?? '?'} view=${flipped ? 'ROTATED 180°' : 'normal'}`;
    console.log(
      `${tag} BEFORE: tap at screen px (${locationX.toFixed(1)}, ${locationY.toFixed(1)}) ` +
        `= (${screenX.toFixed(1)}, ${screenY.toFixed(1)}) of ${FIELD_WIDTH}x${FIELD_HEIGHT} as seen on screen`,
    );
    console.log(
      `${tag} AFTER:  world (${worldX.toFixed(1)}, ${worldY.toFixed(1)}) -> spawn_request ` +
        `(server map: ${worldY < FIELD_HEIGHT / 2 ? 'TOP' : 'BOTTOM'} half)`,
    );

    // Quick local check for instant feedback; the server re-checks everything
    if (screenY < FIELD_HEIGHT - ENDZONE_DEPTH) {
      console.log(`${tag} not sent: tap was outside the bottom endzone on screen`);
      store.getState().setSpawnError('Tap inside your endzone to spawn');
      return;
    }
    service.spawn(worldX, worldY);
  };

  return (
    <View style={styles.area} onLayout={onLayout}>
      {scale > 0 && (
        <Pressable style={{ width: boardWidth, height: boardHeight }} onPressIn={onPressIn}>
          {/* The game board, in world coordinates, rotated for Player 2 */}
          <View style={[styles.board, flipped && styles.rotated]}>
            <View style={[styles.line, { top: '50%' }]} />
            {/* World top = Player 2's endzone, world bottom = Player 1's */}
            <View
              style={[
                styles.endzone,
                { top: 0, backgroundColor: viewAs === 2 ? COLORS.homeEndzone : COLORS.enemyEndzone },
              ]}
            />
            <View
              style={[
                styles.endzone,
                { bottom: 0, backgroundColor: viewAs === 1 ? COLORS.homeEndzone : COLORS.enemyEndzone },
              ]}
            />
            <EntityLayer store={store} scale={scale} flipped={flipped} />
          </View>

          {/* Screen-space overlays: never rotated, so text stays upright */}
          <View style={[styles.endzoneLabelWrap, { top: 0 }]}>
            <Text style={styles.endzoneLabel}>ENEMY ENDZONE</Text>
          </View>
          <View style={[styles.endzoneLabelWrap, { bottom: 0 }]}>
            <Text style={styles.endzoneLabel}>HOME ENDZONE · TAP TO SPAWN</Text>
          </View>
          <Hud store={store} compact={compact} />
          <ManaBar store={store} />
          <SpawnToast store={store} />
          {debugFlipView && (
            <View style={styles.debugBadge}>
              <Text style={styles.debugBadgeText}>DEBUG: VIEW FLIPPED</Text>
            </View>
          )}
        </Pressable>
      )}
    </View>
  );
}

/** Renders every unit at its world position. Re-renders each tick, so it's kept separate from the HUD. */
function EntityLayer({ store, scale, flipped }: { store: GameStore; scale: number; flipped: boolean }) {
  const entities = useStore(store, (s) => s.entities);
  const localSocketId = useStore(store, (s) => s.localSocketId);

  return (
    <View style={styles.overlay}>
      {entities.map((e) => (
        <EntitySquare
          key={e.id}
          left={e.x * scale}
          top={e.y * scale}
          // Your units are blue and the opponent's red, matching your blue home
          // endzone and red enemy endzone. For Player 1 this is Player 1 = blue.
          color={e.ownerId === localSocketId ? COLORS.myUnit : COLORS.enemyUnit}
          health={e.health}
          maxHealth={e.maxHealth}
          attacking={e.state === 'attacking'}
          boardFlipped={flipped}
        />
      ))}
    </View>
  );
}

function Hud({ store, compact }: { store: GameStore; compact: boolean }) {
  // Whole seconds only, so the timer re-renders once a second rather than every tick
  const secondsLeftMs = useStore(store, (s) => Math.ceil(s.matchTimer / 1000) * 1000);
  const myScore = useStore(store, (s) => s.score.you);
  const enemyScore = useStore(store, (s) => s.score.opponent);
  const opponentName = useStore(store, (s) => selectOpponent(s)?.username ?? 'ENEMY');
  const tournamentName = useStore(store, (s) => (s.mode === 'tournament' ? (s.tournament?.name ?? 'Weekly Tournament') : null));

  return (
    <View style={styles.hud}>
      <View style={styles.hudPill}>
        <Text style={[styles.timer, compact && styles.timerCompact]}>{formatTime(secondsLeftMs)}</Text>
        <View style={styles.scoreRow}>
          <Text style={[styles.score, { color: COLORS.homeEndzone }]}>YOU {myScore}</Text>
          <Text style={styles.scoreDash}>–</Text>
          <Text style={[styles.score, { color: COLORS.enemyEndzone }]}>
            {enemyScore} {opponentName}
          </Text>
        </View>
      </View>
      {tournamentName && (
        <View style={styles.mirrorBanner}>
          <Text style={styles.mirrorTitle}>⚔ MIRROR MATCH</Text>
          <Text style={styles.mirrorSub}>{tournamentName} · identical decks</Text>
        </View>
      )}
    </View>
  );
}

function ManaBar({ store }: { store: GameStore }) {
  const mana = useStore(store, (s) => s.mana);
  const canSpawn = mana >= SPAWN_COST;

  return (
    <View style={styles.manaWrap}>
      <View style={styles.manaTrack}>
        <View style={[styles.manaFill, { width: `${(mana / MAX_MANA) * 100}%`, opacity: canSpawn ? 1 : 0.55 }]} />
        {/* One divider per mana point */}
        {Array.from({ length: MAX_MANA - 1 }, (_, i) => (
          <View key={i} style={[styles.manaDivider, { left: `${((i + 1) / MAX_MANA) * 100}%` }]} />
        ))}
      </View>
      <Text style={styles.manaText}>
        {Math.floor(mana)} / {MAX_MANA}
      </Text>
    </View>
  );
}

/** Briefly shows why a spawn was refused (by the client check or the server). */
function SpawnToast({ store }: { store: GameStore }) {
  const spawnError = useStore(store, (s) => s.spawnError);

  useEffect(() => {
    if (!spawnError) return;
    const t = setTimeout(() => store.getState().setSpawnError(null), 1200);
    return () => clearTimeout(t);
  }, [spawnError, store]);

  if (!spawnError) return null;
  return (
    <View style={styles.toastWrap}>
      <Text style={styles.toast}>{spawnError.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  area: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  board: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.field,
    borderRadius: 12,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  rotated: { transform: [{ rotate: '180deg' }] },
  line: { position: 'absolute', left: 0, right: 0, height: 3, backgroundColor: COLORS.fieldLine },
  endzone: { position: 'absolute', left: 0, right: 0, height: ENDZONE_PCT },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  endzoneLabelWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ENDZONE_PCT,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  endzoneLabel: { color: 'rgba(0,0,0,0.35)', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },

  hud: { position: 'absolute', top: 6, left: 0, right: 0, alignItems: 'center', gap: 4, pointerEvents: 'none' },
  hudPill: { backgroundColor: 'rgba(10,12,18,0.72)', borderRadius: 14, paddingVertical: 4, paddingHorizontal: 16, alignItems: 'center' },
  timer: { color: '#fff', fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  timerCompact: { fontSize: 20 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  score: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  scoreDash: { color: '#fff', fontSize: 14, fontWeight: '800' },
  mirrorBanner: { backgroundColor: '#ffb020', borderRadius: 10, paddingVertical: 3, paddingHorizontal: 12, alignItems: 'center' },
  mirrorTitle: { color: '#1a1200', fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
  mirrorSub: { color: '#1a1200', fontSize: 10, fontWeight: '700' },

  manaWrap: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    pointerEvents: 'none',
  },
  manaTrack: { flex: 1, height: 16, borderRadius: 8, backgroundColor: 'rgba(10,12,18,0.6)', overflow: 'hidden' },
  manaFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: COLORS.mana },
  manaDivider: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.35)' },
  manaText: { color: '#fff', fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'], minWidth: 44, textAlign: 'right' },

  toastWrap: { position: 'absolute', top: '55%', left: 0, right: 0, alignItems: 'center', pointerEvents: 'none' },
  toast: {
    color: '#fff',
    backgroundColor: 'rgba(10,12,18,0.8)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    overflow: 'hidden',
    fontWeight: '700',
  },
  debugBadge: { position: 'absolute', top: '42%', alignSelf: 'center', backgroundColor: '#ff00aa', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, pointerEvents: 'none' },
  debugBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
});
