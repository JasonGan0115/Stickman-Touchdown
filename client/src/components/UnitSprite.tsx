import { memo, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useStore } from 'zustand';

import { SPRITE_SIZE, TICK_MS } from '../game/constants';
import type { Entity, GameStore, MovementType, UnitType } from '../store/useGameStore';
import { Stickman } from './Stickman';
import Svg, { Circle, Polygon, Rect } from 'react-native-svg';

const HALF = SPRITE_SIZE / 2;

interface Look {
  color: string;
  /** Enemy units are mirrored so the two sides face each other */
  mine: boolean;
  /** The board is rotated 180°; the figure is turned back so it stays upright */
  boardFlipped: boolean;
}

/**
 * A live unit on the field. Performance: it does NOT re-render on every server
 * tick. Its position is fed straight from the store into shared values (the
 * glide runs on the UI thread), and React only re-renders it when something
 * visible changes: health, fighting or not, or a new hit.
 */
function LiveUnitBase({ store, id, scale, ...look }: Look & { store: GameStore; id: string; scale: number }) {
  // Snapshot at spawn: start position, and maxHealth (which never changes)
  const [first] = useState(() => findUnit(store.getState().entities, id));
  const x = useSharedValue((first?.x ?? 0) * scale - HALF);
  const y = useSharedValue((first?.y ?? 0) * scale - HALF);

  useEffect(() => {
    let lastX = NaN;
    let lastY = NaN;
    const follow = (entities: Entity[]) => {
      const e = findUnit(entities, id);
      if (!e || (e.x === lastX && e.y === lastY)) return;
      lastX = e.x;
      lastY = e.y;
      // Glide to the new position over one tick instead of jumping
      const glide = { duration: TICK_MS, easing: Easing.linear };
      x.value = withTiming(e.x * scale - HALF, glide);
      y.value = withTiming(e.y * scale - HALF, glide);
    };
    follow(store.getState().entities);
    return store.subscribe((s, prev) => {
      if (s.entities !== prev.entities) follow(s.entities);
    });
  }, [store, id, scale, x, y]);

  const cardId = first?.cardId ?? '';
  const type = useStore(store, (s) => findUnit(s.entities, id)?.type ?? first?.type ?? 'Melee');
  const movement = useStore(store, (s) => findUnit(s.entities, id)?.movement ?? first?.movement);
  const health = useStore(store, (s) => findUnit(s.entities, id)?.health ?? 0);
  const maxHealth = first?.maxHealth ?? 1;
  const attacking = useStore(store, (s) => findUnit(s.entities, id)?.state === 'attacking');
  const lastHitTick = useStore(store, (s) => findUnit(s.entities, id)?.lastHitTick ?? -1);

  return (
    <UnitBody
      x={x}
      y={y}
      cardId={cardId}
      type={type}
      movement={movement}
      health={health}
      maxHealth={maxHealth}
      attacking={attacking}
      lastHitTick={lastHitTick}
      {...look}
    />
  );
}

export const LiveUnit = memo(LiveUnitBase);

/** A unit that just died: falls over and fades where it stood. */
function DyingUnitBase({ entity, scale, ...look }: Look & { entity: Entity; scale: number }) {
  const x = useSharedValue(entity.x * scale - HALF);
  const y = useSharedValue(entity.y * scale - HALF);
  return (
    <UnitBody
      dying
      x={x}
      y={y}
      cardId={entity.cardId}
      type={entity.type}
      movement={entity.movement}
      health={0}
      maxHealth={entity.maxHealth}
      attacking={false}
      lastHitTick={-1}
      {...look}
    />
  );
}

export const DyingUnit = memo(DyingUnitBase);

interface BodyProps extends Look {
  x: SharedValue<number>; // top-left, px on the (unrotated) board
  y: SharedValue<number>;
  cardId: string;
  type: UnitType | 'Tower';
  movement?: MovementType;
  health: number;
  maxHealth: number;
  attacking: boolean;
  lastHitTick: number;
  dying?: boolean;
}

const TowerSilhouette = memo(function TowerSilhouette({ cardId, color, size }: { cardId: string; color: string; size: number }) {
  const isMagnet = cardId === 'card_magnet_tower';
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Stone/metal base */}
      <Rect x={24} y={66} width={52} height={22} rx={5} fill="#2b303d" stroke={color} strokeWidth={4} />
      {/* Tower pillar */}
      <Polygon points="34,66 40,28 60,28 66,66" fill="#434b5e" stroke="#d3d1c7" strokeWidth={3} />
      {/* Turret top */}
      {isMagnet ? (
        <>
          <Circle cx={50} cy={24} r={13} fill={color} stroke="#f4f6fb" strokeWidth={3} />
          <Circle cx={50} cy={24} r={5} fill="#fde047" />
        </>
      ) : (
        <>
          <Rect x={34} y={16} width={32} height={16} rx={4} fill={color} stroke="#f4f6fb" strokeWidth={3} />
          <Rect x={46} y={6} width={8} height={14} rx={2} fill="#38bdf8" />
        </>
      )}
    </Svg>
  );
});

const UnitBody = memo(function UnitBody({
  x,
  y,
  cardId,
  type,
  movement,
  health,
  maxHealth,
  attacking,
  lastHitTick,
  color,
  mine,
  boardFlipped,
  dying = false,
}: BodyProps) {
  const pop = useSharedValue(dying ? 1 : 0);
  const flash = useSharedValue(1);
  const fall = useSharedValue(0);
  const lastHealth = useRef(health);

  // Pop in when spawned, or fall over and fade when dying
  useEffect(() => {
    if (dying) fall.value = withTiming(1, { duration: 550, easing: Easing.in(Easing.quad) });
    else pop.value = withSpring(1, { damping: 9, stiffness: 220 });
  }, [dying, fall, pop]);

  // Blink when hit
  useEffect(() => {
    if (health < lastHealth.current) flash.value = withSequence(withTiming(0.25, { duration: 0 }), withTiming(1, { duration: 220 }));
    lastHealth.current = health;
  }, [health, flash]);

  const outer = useAnimatedStyle(() => ({
    opacity: fall.value < 0.6 ? 1 - fall.value / 3 : 0.8 * (1 - (fall.value - 0.6) / 0.4),
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: pop.value }],
  }));
  const figure = useAnimatedStyle(() => ({
    opacity: flash.value,
    transform: [{ rotate: `${fall.value * (mine ? -90 : 90)}deg` }],
  }));

  const healthPct = Math.max(0, Math.min(1, health / maxHealth));
  const healthColor = healthPct > 0.5 ? '#3ddc84' : healthPct > 0.25 ? '#ffb020' : '#ff4d4d';

  const isFlying = movement === 'flying';

  return (
    <Animated.View style={[styles.unit, outer]}>
      {/* Flight elevation shadow */}
      {isFlying && !dying && <View style={styles.flightShadow} />}
      {/* Undo the board's 180° turn so the figure and its health bar read upright */}
      <View style={[styles.fill, boardFlipped && styles.upright, isFlying && styles.flyingElevated]}>
        {!dying && (
          <View style={styles.healthTrack}>
            <View style={[styles.healthFill, { width: `${healthPct * 100}%`, backgroundColor: healthColor }]} />
          </View>
        )}
        {attacking && !dying && <View style={styles.attackRing} />}
        <Animated.View style={[styles.fill, figure]}>
          <View style={[styles.fill, !mine && styles.mirrored]}>
            {type === 'Tower' ? (
              <TowerSilhouette cardId={cardId} color={color} size={SPRITE_SIZE} />
            ) : (
              <Stickman
                type={type}
                movement={movement}
                teamColor={color}
                size={SPRITE_SIZE}
                walking={!attacking && !dying}
                attackTick={dying ? -1 : lastHitTick}
              />
            )}
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
});

function findUnit(entities: Entity[], id: string): Entity | undefined {
  for (const e of entities) if (e.id === id) return e;
  return undefined;
}

const styles = StyleSheet.create({
  unit: { position: 'absolute', left: 0, top: 0, width: SPRITE_SIZE, height: SPRITE_SIZE, pointerEvents: 'none' },
  fill: { width: SPRITE_SIZE, height: SPRITE_SIZE },
  upright: { transform: [{ rotate: '180deg' }] },
  mirrored: { transform: [{ scaleX: -1 }] },
  flyingElevated: { transform: [{ translateY: -6 }] },
  flightShadow: {
    position: 'absolute',
    bottom: -2,
    left: SPRITE_SIZE * 0.25,
    width: SPRITE_SIZE * 0.5,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  attackRing: {
    position: 'absolute',
    left: SPRITE_SIZE * 0.2,
    right: SPRITE_SIZE * 0.2,
    bottom: 0,
    height: SPRITE_SIZE * 0.18,
    borderRadius: SPRITE_SIZE,
    backgroundColor: 'rgba(255,212,0,0.45)',
  },
  healthTrack: {
    position: 'absolute',
    top: -4,
    left: SPRITE_SIZE * 0.15,
    width: SPRITE_SIZE * 0.7,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    overflow: 'hidden',
  },
  healthFill: { height: '100%' },
});
