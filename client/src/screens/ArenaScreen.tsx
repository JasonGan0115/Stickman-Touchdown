import { memo, useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import { EffectsLayer } from '../components/EffectsLayer';
import { Stickman } from '../components/Stickman';
import { LiveUnit } from '../components/UnitSprite';
import { ENDZONE_DEPTH, FIELD_HEIGHT, FIELD_WIDTH, MAX_MANA } from '../game/constants';
import type { SocketService } from '../services/SocketService';
import { selectMe, selectOpponent, selectSelectedCard, type GameStore } from '../store/useGameStore';

const COLORS = {
  field: '#2f8f3a',
  fieldStripe: '#2a8133', // every other band between the endzones, like mowed grass
  fieldLine: 'rgba(255,255,255,0.25)',
  homeEndzone: '#8fd3ff', // light blue
  enemyEndzone: '#ff9a9a', // light red
  myUnit: '#1f5fff', // blue
  enemyUnit: '#e0262b', // red
  mana: '#b14cff',
};

// Logs every tap's screen/world coordinates to Metro. Handy for debugging the
// rotated Player 2 view, but slow when spamming taps, so it's off by default.
const LOG_TAPS = false;

const ENDZONE_PCT = `${(ENDZONE_DEPTH / FIELD_HEIGHT) * 100}%` as const;

// The field between the endzones is split into 10 bands with a yard line between each
const FIELD_BANDS = 10;
const BAND_PCT = ((FIELD_HEIGHT - 2 * ENDZONE_DEPTH) / FIELD_HEIGHT) * 100 / FIELD_BANDS;
const ENDZONE_PCT_NUM = (ENDZONE_DEPTH / FIELD_HEIGHT) * 100;

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
  const localSocketId = useStore(store, (s) => s.localSocketId);
  const colorFor = useCallback(
    (ownerId: string) => (ownerId === localSocketId ? COLORS.myUnit : COLORS.enemyUnit),
    [localSocketId],
  );
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
    if (LOG_TAPS) console.log(
      `${tag} BEFORE: tap at screen px (${locationX.toFixed(1)}, ${locationY.toFixed(1)}) ` +
        `= (${screenX.toFixed(1)}, ${screenY.toFixed(1)}) of ${FIELD_WIDTH}x${FIELD_HEIGHT} as seen on screen`,
    );
    if (LOG_TAPS) console.log(
      `${tag} AFTER:  world (${worldX.toFixed(1)}, ${worldY.toFixed(1)}) -> spawn_request ` +
        `(server map: ${worldY < FIELD_HEIGHT / 2 ? 'TOP' : 'BOTTOM'} half)`,
    );

    // Quick local checks for instant feedback; the server re-checks everything
    const state = store.getState();
    const card = selectSelectedCard(state);
    if (!card) {
      state.setSpawnError('Pick a card first');
      return;
    }
    if (screenY < FIELD_HEIGHT - ENDZONE_DEPTH) {
      if (LOG_TAPS) console.log(`${tag} not sent: tap was outside the bottom endzone on screen`);
      state.setSpawnError('Tap inside your endzone to spawn');
      return;
    }
    if (state.mana < card.cost) {
      state.setSpawnError(`Not enough mana for ${card.name} (need ${card.cost})`);
      return;
    }
    service.spawn(card.cardId, worldX, worldY);
  };

  return (
    <View style={styles.root}>
      <View style={styles.area} onLayout={onLayout}>
        {scale > 0 && (
          <Pressable style={{ width: boardWidth, height: boardHeight }} onPressIn={onPressIn}>
            {/* The game board, in world coordinates, rotated for Player 2 */}
            <View style={[styles.board, flipped && styles.rotated]}>
<FieldStripes />
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
              <EffectsLayer store={store} scale={scale} flipped={flipped} colorFor={colorFor} localSocketId={localSocketId} />
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
      <CardHand store={store} compact={compact} />
      {!compact && <BoostsLine store={store} />}
    </View>
  );
}

/** Grass bands and yard lines between the two endzones. Static, drawn under everything else. */
const FieldStripes = memo(function FieldStripes() {
  return (
    <>
      {Array.from({ length: FIELD_BANDS }, (_, i) => (
        <View
          key={i}
          style={[
            styles.band,
            { top: `${ENDZONE_PCT_NUM + i * BAND_PCT}%`, height: `${BAND_PCT}%` },
            i % 2 === 1 && { backgroundColor: COLORS.fieldStripe },
          ]}
        />
      ))}
      {Array.from({ length: FIELD_BANDS + 1 }, (_, i) => (
        <View key={`l${i}`} style={[styles.yardLine, { top: `${ENDZONE_PCT_NUM + i * BAND_PCT}%` }]} />
      ))}
    </>
  );
});

/**
 * One LiveUnit per unit on the field. This only re-renders when units appear
 * or disappear; each unit follows its own position and health from the store.
 */
function EntityLayer({ store, scale, flipped }: { store: GameStore; scale: number; flipped: boolean }) {
  // "id:owner" pairs; useShallow keeps the array stable while the same units are on the field
  const units = useStore(store, useShallow((s) => s.entities.map((e) => `${e.id}:${e.ownerId}`)));
  const localSocketId = useStore(store, (s) => s.localSocketId);

  return (
    <View style={styles.overlay}>
      {units.map((key) => {
        const [id, ownerId] = splitUnitKey(key);
        const mine = ownerId === localSocketId;
        return (
          <LiveUnit
            key={id}
            store={store}
            id={id}
            scale={scale}
            // Your units are blue and the opponent's red, matching your blue home
            // endzone and red enemy endzone. For Player 1 this is Player 1 = blue.
            color={mine ? COLORS.myUnit : COLORS.enemyUnit}
            mine={mine}
            boardFlipped={flipped}
          />
        );
      })}
    </View>
  );
}

function splitUnitKey(key: string): [string, string] {
  const i = key.indexOf(':');
  return [key.slice(0, i), key.slice(i + 1)];
}

function Hud({ store, compact }: { store: GameStore; compact: boolean }) {
  // Whole seconds only, so the timer re-renders once a second rather than every tick
  const secondsLeftMs = useStore(store, (s) => Math.ceil(s.matchTimer / 1000) * 1000);
  const myScore = useStore(store, (s) => s.score.you);
  const enemyScore = useStore(store, (s) => s.score.opponent);
  const opponentName = useStore(store, (s) => selectOpponent(s)?.username ?? 'ENEMY');
  const tournamentName = useStore(store, (s) => (s.mode === 'tournament' ? (s.tournament?.name ?? 'Weekly Tournament') : null));
  const aiLabel = useStore(store, (s) => (!s.ai ? null : s.ai.autoplay ? 'AI VS AI · WATCHING' : 'PRACTICE VS AI'));

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
      {aiLabel && (
        <View style={styles.aiBanner}>
          <Text style={styles.aiBannerText}>{aiLabel}</Text>
        </View>
      )}
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
  const cost = useStore(store, (s) => selectSelectedCard(s)?.cost ?? Infinity);
  const canSpawn = mana >= cost;

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

/**
 * The player's cards for this match. Tap one to select it, then tap the
 * endzone to spawn it. Cards you can't afford yet are dimmed. Mana is only
 * read here as whole points, so this re-renders once per mana point, not every tick.
 */
function CardHand({ store, compact }: { store: GameStore; compact: boolean }) {
  const hand = useStore(store, (s) => s.hand);
  const selectedCardId = useStore(store, (s) => s.selectedCardId);
  const wholeMana = useStore(store, (s) => Math.floor(s.mana));

  if (!hand.length) return null;
  return (
    <View style={styles.hand}>
      {hand.map((card) => {
        const selected = card.cardId === selectedCardId;
        const affordable = wholeMana >= card.cost;
        return (
          <Pressable
            key={card.cardId}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${card.name}, ${card.cost} mana`}
            onPress={() => store.getState().selectCard(card.cardId)}
            style={({ pressed }) => [
              styles.card,
              compact && styles.cardCompact,
              selected && styles.cardSelected,
              !affordable && styles.cardUnaffordable,
              pressed && styles.cardPressed,
            ]}
          >
            <View style={styles.cardCost}>
              <Text style={styles.cardCostText}>{card.cost}</Text>
            </View>
            <Stickman type={card.type} teamColor={COLORS.myUnit} size={compact ? 28 : 40} animated={false} />
            <Text style={styles.cardName} numberOfLines={1}>
              {card.name}
            </Text>
            {!compact && <Text style={styles.cardType}>{card.type}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

/** This match's augment effects, so the player can see their deck's augments are doing something. */
function BoostsLine({ store }: { store: GameStore }) {
  const boosts = useStore(store, (s) => s.boosts);
  if (!boosts.length) return null;
  return (
    <Text style={styles.boosts} numberOfLines={2}>
      Augments: {boosts.join(' · ')}
    </Text>
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
  root: { flex: 1, alignSelf: 'stretch', gap: 8 },
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
  band: { position: 'absolute', left: 0, right: 0 },
  yardLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.18)' },
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
  aiBanner: { backgroundColor: '#534ab7', borderRadius: 10, paddingVertical: 3, paddingHorizontal: 12 },
  aiBannerText: { color: '#eeedfe', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },

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
  hand: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  card: {
    flex: 1,
    minHeight: 76,
    backgroundColor: '#262a35',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  cardCompact: { minHeight: 48, paddingVertical: 3 },
  cardSelected: { borderColor: COLORS.homeEndzone, backgroundColor: '#2f3a52' },
  cardUnaffordable: { opacity: 0.45 },
  cardPressed: { transform: [{ scale: 0.96 }] },
  cardCost: {
    position: 'absolute',
    top: 4,
    left: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.mana,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCostText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  cardName: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardType: { color: '#8a8f9c', fontSize: 10 },
  boosts: { color: '#c9a6ff', fontSize: 11, fontWeight: '700', textAlign: 'center', paddingHorizontal: 8 },

  debugBadge: { position: 'absolute', top: '42%', alignSelf: 'center', backgroundColor: '#ff00aa', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, pointerEvents: 'none' },
  debugBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
});
