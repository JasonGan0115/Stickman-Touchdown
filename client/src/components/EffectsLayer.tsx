import { memo, useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useStore } from 'zustand';

import { CASTER_SPLASH_RADIUS, type Effect } from '../game/effects';
import type { GameStore } from '../store/useGameStore';
import { DyingUnit } from './UnitSprite';

const SHOT_MS = 170;

interface LayerProps {
  store: GameStore;
  scale: number;
  flipped: boolean;
  colorFor: (ownerId: string) => string;
  localSocketId: string | null;
}

/** Arrows, magic blasts, damage numbers and falling units, drawn over the board in world coordinates. */
export function EffectsLayer({ store, scale, flipped, colorFor, localSocketId }: LayerProps) {
  const effects = useStore(store, (s) => s.effects);
  return (
    <View style={styles.overlay}>
      {effects.map((e) => {
        switch (e.kind) {
          case 'death':
            return (
              <DyingUnit
                key={e.id}
                entity={e.entity}
                scale={scale}
                color={colorFor(e.entity.ownerId)}
                mine={e.entity.ownerId === localSocketId}
                boardFlipped={flipped}
              />
            );
          case 'projectile':
            return <Projectile key={e.id} effect={e} scale={scale} color={colorFor(e.ownerId)} />;
          case 'damage':
            return <DamageNumber key={e.id} effect={e} scale={scale} flipped={flipped} />;
        }
      })}
    </View>
  );
}

type ProjectileEffect = Extract<Effect, { kind: 'projectile' }>;

const Projectile = memo(function Projectile({ effect, scale, color }: { effect: ProjectileEffect; scale: number; color: string }) {
  const from = { x: effect.fromX * scale, y: effect.fromY * scale };
  const to = { x: effect.toX * scale, y: effect.toY * scale };
  const [t] = useState(() => new Animated.Value(0));
  const [ring] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.sequence([
      Animated.timing(t, { toValue: 1, duration: SHOT_MS, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(ring, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [t, ring]);

  const x = t.interpolate({ inputRange: [0, 1], outputRange: [from.x, to.x] });
  const y = t.interpolate({ inputRange: [0, 1], outputRange: [from.y, to.y] });
  const shotOpacity = t.interpolate({ inputRange: [0, 0.95, 1], outputRange: [1, 1, 0] });
  const angle = `${Math.atan2(to.y - from.y, to.x - from.x)}rad`;

  if (effect.style === 'arrow') {
    return (
      <Animated.View
        style={[styles.arrow, { opacity: shotOpacity, transform: [{ translateX: x }, { translateY: y }, { rotate: angle }] }]}
      >
        <View style={styles.arrowShaft} />
        <View style={[styles.arrowHead, { borderLeftColor: '#e8e4d8' }]} />
      </Animated.View>
    );
  }

  // Battle Mage: an orb flies to the target, then a ring shows the splash area
  const ringSize = CASTER_SPLASH_RADIUS * 2 * scale;
  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 0.01, 1], outputRange: [0, 0.9, 0] });
  return (
    <>
      <Animated.View style={[styles.orb, { opacity: shotOpacity, transform: [{ translateX: x }, { translateY: y }] }]} />
      <Animated.View
        style={[
          styles.splash,
          {
            width: ringSize,
            height: ringSize,
            left: to.x - ringSize / 2,
            top: to.y - ringSize / 2,
            borderColor: color,
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          },
        ]}
      />
    </>
  );
});

type DamageEffect = Extract<Effect, { kind: 'damage' }>;

const DamageNumber = memo(function DamageNumber({ effect, scale, flipped }: { effect: DamageEffect; scale: number; flipped: boolean }) {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [t]);
  const rise = t.interpolate({ inputRange: [0, 1], outputRange: [0, -22] });
  const opacity = t.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });

  return (
    // The outer view undoes the board's rotation, so the number reads upright and rises up the screen.
    // It sits just above the unit on screen, which is below it in board coordinates when the board is flipped.
    <View
      style={[
        styles.damageAnchor,
        { left: effect.x * scale - 20, top: effect.y * scale + (flipped ? 6 : -26) },
        flipped && styles.upright,
      ]}
    >
      <Animated.Text style={[styles.damage, { opacity, transform: [{ translateY: rise }] }]}>-{Math.round(effect.amount)}</Animated.Text>
    </View>
  );
});

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' },
  upright: { transform: [{ rotate: '180deg' }] },
  arrow: { position: 'absolute', left: -8, top: -2, width: 16, height: 4, flexDirection: 'row', alignItems: 'center' },
  arrowShaft: { width: 11, height: 2, backgroundColor: '#e8e4d8' },
  arrowHead: {
    width: 0,
    height: 0,
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderLeftWidth: 5,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  orb: { position: 'absolute', left: -5, top: -5, width: 10, height: 10, borderRadius: 5, backgroundColor: '#afa9ec', borderWidth: 2, borderColor: '#eeedfe' },
  splash: { position: 'absolute', borderRadius: 999, borderWidth: 3 },
  damageAnchor: { position: 'absolute', width: 40, height: 20, alignItems: 'center' },
  damage: { color: '#ffd84d', fontSize: 13, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 2, textShadowOffset: { width: 0, height: 1 } },
});
