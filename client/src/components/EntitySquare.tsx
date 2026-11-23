import { memo, useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { TICK_MS, UNIT_SIZE } from '../game/constants';

interface Props {
  /** Centre of the unit, in pixels relative to the (unrotated) board */
  left: number;
  top: number;
  color: string;
  health: number;
  maxHealth: number;
  attacking: boolean;
  /** The board is rotated 180°; put the health bar on the other side so it still shows above the unit */
  boardFlipped: boolean;
}

/**
 * A 30x30 unit. The server sends a new position every tick (~33ms); instead of
 * jumping, the square glides to each new position over one tick on the native
 * thread, so motion stays smooth even if a packet arrives a little late.
 */
function EntitySquareBase({ left, top, color, health, maxHealth, attacking, boardFlipped }: Props) {
  // Created once per unit (lazy useState initializer); Animated values are mutated
  // by the animation driver, never replaced, so they don't trigger re-renders.
  const [position] = useState(() => new Animated.ValueXY({ x: left - UNIT_SIZE / 2, y: top - UNIT_SIZE / 2 }));
  const [scale] = useState(() => new Animated.Value(0));

  // Pop in when spawned
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 160, useNativeDriver: true }).start();
  }, [scale]);

  useEffect(() => {
    Animated.timing(position, {
      toValue: { x: left - UNIT_SIZE / 2, y: top - UNIT_SIZE / 2 },
      duration: TICK_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [left, top, position]);

  const healthPct = Math.max(0, Math.min(1, health / maxHealth));
  const healthColor = healthPct > 0.5 ? '#3ddc84' : healthPct > 0.25 ? '#ffb020' : '#ff4d4d';

  return (
    <Animated.View
      style={[styles.unit, { transform: [{ translateX: position.x }, { translateY: position.y }, { scale }] }]}
    >
      <View style={[styles.square, { backgroundColor: color }, attacking && styles.attacking]} />
      <View style={[styles.healthTrack, boardFlipped ? styles.healthBelow : styles.healthAbove]}>
        <View style={[styles.healthFill, { width: `${healthPct * 100}%`, backgroundColor: healthColor }]} />
      </View>
    </Animated.View>
  );
}

export const EntitySquare = memo(EntitySquareBase);

const styles = StyleSheet.create({
  unit: { position: 'absolute', left: 0, top: 0, width: UNIT_SIZE, height: UNIT_SIZE, pointerEvents: 'none' },
  square: {
    width: UNIT_SIZE,
    height: UNIT_SIZE,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  attacking: { borderColor: '#ffd400', borderWidth: 3 },
  healthTrack: {
    position: 'absolute',
    left: 0,
    width: UNIT_SIZE,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    overflow: 'hidden',
  },
  healthAbove: { top: -7 },
  healthBelow: { bottom: -7 },
  healthFill: { height: '100%' },
});
