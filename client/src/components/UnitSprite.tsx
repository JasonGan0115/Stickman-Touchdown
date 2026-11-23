import { memo, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { SPRITE_SIZE, TICK_MS } from '../game/constants';
import type { UnitType } from '../store/useGameStore';
import { Stickman } from './Stickman';

interface Props {
  /** Centre of the unit, in pixels relative to the (unrotated) board */
  left: number;
  top: number;
  color: string;
  type: UnitType;
  health: number;
  maxHealth: number;
  attacking: boolean;
  lastHitTick: number;
  /** Enemy units are mirrored so the two sides face each other */
  mine: boolean;
  /** The board is rotated 180°; the figure is turned back so it stays upright */
  boardFlipped: boolean;
  /** Plays the fall-over-and-fade animation instead of walking (for units that just died) */
  dying?: boolean;
}

/**
 * A stickman unit. The server sends a new position every tick (~33ms); instead
 * of jumping, the unit glides to each new position over one tick on the native
 * thread, so motion stays smooth even if a packet arrives a little late.
 */
function UnitSpriteBase({ left, top, color, type, health, maxHealth, attacking, lastHitTick, mine, boardFlipped, dying = false }: Props) {
  // Created once per unit (lazy useState initializer); Animated values are mutated
  // by the animation driver, never replaced, so they don't trigger re-renders.
  const [position] = useState(() => new Animated.ValueXY({ x: left - SPRITE_SIZE / 2, y: top - SPRITE_SIZE / 2 }));
  const [scale] = useState(() => new Animated.Value(dying ? 1 : 0));
  const [flash] = useState(() => new Animated.Value(1));
  const [fall] = useState(() => new Animated.Value(0));
  const lastHealth = useRef(health);

  // Pop in when spawned, or fall over and fade when dying
  useEffect(() => {
    if (dying) {
      Animated.timing(fall, { toValue: 1, duration: 550, easing: Easing.in(Easing.quad), useNativeDriver: true }).start();
    } else {
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 160, useNativeDriver: true }).start();
    }
  }, [dying, fall, scale]);

  useEffect(() => {
    if (dying) return;
    Animated.timing(position, {
      toValue: { x: left - SPRITE_SIZE / 2, y: top - SPRITE_SIZE / 2 },
      duration: TICK_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [left, top, position, dying]);

  // Blink when hit
  useEffect(() => {
    if (health < lastHealth.current) {
      flash.setValue(0.25);
      Animated.timing(flash, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    }
    lastHealth.current = health;
  }, [health, flash]);

  const healthPct = Math.max(0, Math.min(1, health / maxHealth));
  const healthColor = healthPct > 0.5 ? '#3ddc84' : healthPct > 0.25 ? '#ffb020' : '#ff4d4d';
  const fallRotate = fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', mine ? '-90deg' : '90deg'] });
  const fallOpacity = fall.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 0.8, 0] });

  return (
    <Animated.View style={[styles.unit, { opacity: fallOpacity, transform: [{ translateX: position.x }, { translateY: position.y }, { scale }] }]}>
      {/* Undo the board's 180° turn so the figure and its health bar read upright */}
      <View style={[styles.fill, boardFlipped && styles.upright]}>
        {!dying && (
          <View style={styles.healthTrack}>
            <View style={[styles.healthFill, { width: `${healthPct * 100}%`, backgroundColor: healthColor }]} />
          </View>
        )}
        {attacking && !dying && <View style={styles.attackRing} />}
        <Animated.View style={[styles.fill, { opacity: flash, transform: [{ rotate: fallRotate }] }]}>
          <View style={[styles.fill, !mine && styles.mirrored]}>
            <Stickman type={type} teamColor={color} size={SPRITE_SIZE} walking={!attacking && !dying} attackTick={dying ? -1 : lastHitTick} />
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

export const UnitSprite = memo(UnitSpriteBase);

const styles = StyleSheet.create({
  unit: { position: 'absolute', left: 0, top: 0, width: SPRITE_SIZE, height: SPRITE_SIZE, pointerEvents: 'none' },
  fill: { width: SPRITE_SIZE, height: SPRITE_SIZE },
  upright: { transform: [{ rotate: '180deg' }] },
  mirrored: { transform: [{ scaleX: -1 }] },
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
