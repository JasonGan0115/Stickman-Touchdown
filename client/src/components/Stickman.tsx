import { memo, useEffect, type ReactNode } from 'react';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import type { UnitType } from '../store/useGameStore';

const ALine = Animated.createAnimatedComponent(Line);
const ACircle = Animated.createAnimatedComponent(Circle);

// Drawn in a 100x100 box. The figure faces right; the caller mirrors it for the enemy.
const BODY = '#f4f6fb';
const STEEL = '#d3d1c7';
const WOOD = '#ba7517';
const HIP = { x: 50, y: 62 };
const LEG_LENGTH = 24;
const LEG_SWING_DEG = 24;

interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: string; // defaults to the body colour; 'team' = team colour
  width?: number; // defaults to the figure's line width
}

interface Design {
  lineWidth: number;
  headR: number;
  shoulder: { x: number; y: number };
  swingDeg: number; // how far the weapon arm rotates on a hit (negative = upward)
  walkMs: number; // one leg swing; slower units step slower
  arm: Seg[]; // rotates with the swing: the weapon arm and what it holds
  orb?: { x: number; y: number; r: number }; // rotates with the arm (Battle Mage)
  extras?: (team: string) => ReactNode; // static decorations (bow, hat), drawn over the head
}

const DESIGNS: Record<UnitType, Design> = {
  Melee: {
    lineWidth: 5,
    headR: 9,
    shoulder: { x: 50, y: 40 },
    swingDeg: -75,
    walkMs: 220,
    arm: [
      { x1: 50, y1: 40, x2: 64, y2: 50 },
      { x1: 64, y1: 50, x2: 82, y2: 28, color: STEEL, width: 4 }, // blade
      { x1: 59, y1: 45, x2: 69, y2: 55, color: STEEL, width: 4 }, // crossguard
    ],
  },
  Ranged: {
    lineWidth: 5,
    headR: 9,
    shoulder: { x: 50, y: 40 },
    swingDeg: 0, // archers shoot; the arrow is drawn as a projectile
    walkMs: 280,
    arm: [
      { x1: 50, y1: 40, x2: 66, y2: 42 },
      { x1: 50, y1: 40, x2: 58, y2: 45 },
    ],
    extras: () => (
      <>
        <Path d="M66 24 Q82 42 66 60" stroke={WOOD} strokeWidth={4} fill="none" strokeLinecap="round" />
        <Line x1={66} y1={24} x2={66} y2={60} stroke={STEEL} strokeWidth={1.5} />
      </>
    ),
  },
  Tank: {
    lineWidth: 7,
    headR: 10,
    shoulder: { x: 50, y: 42 },
    swingDeg: -25, // a shield bash
    walkMs: 380,
    arm: [
      { x1: 50, y1: 42, x2: 62, y2: 46 },
      { x1: 70, y1: 30, x2: 70, y2: 62, color: '#b5d4f4', width: 20 }, // shield rim
      { x1: 70, y1: 31, x2: 70, y2: 61, color: 'team', width: 14 }, // shield face
    ],
  },
  Caster: {
    lineWidth: 5,
    headR: 8,
    shoulder: { x: 50, y: 40 },
    swingDeg: -35, // raises the staff
    walkMs: 320,
    arm: [
      { x1: 50, y1: 40, x2: 66, y2: 44 },
      { x1: 68, y1: 26, x2: 68, y2: 72, color: WOOD, width: 4 }, // staff
    ],
    orb: { x: 68, y: 22, r: 6 },
    extras: () => <Path d="M40 19 L50 3 L60 19 Z" fill="#534ab7" stroke="#cecbf6" strokeWidth={2} />,
  },
};

/** Rotates (px, py) around (ox, oy) by deg degrees. */
function rotate(px: number, py: number, ox: number, oy: number, deg: number) {
  'worklet';
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const dx = px - ox;
  const dy = py - oy;
  return { x: ox + dx * c - dy * s, y: oy + dx * s + dy * c };
}

function Leg({ phase, direction, width }: { phase: SharedValue<number>; direction: 1 | -1; width: number }) {
  const props = useAnimatedProps(() => {
    const a = (phase.value * LEG_SWING_DEG * direction * Math.PI) / 180;
    return { x2: HIP.x + Math.sin(a) * LEG_LENGTH, y2: HIP.y + Math.cos(a) * LEG_LENGTH };
  });
  return (
    <ALine
      x1={HIP.x}
      y1={HIP.y}
      x2={HIP.x}
      y2={HIP.y + LEG_LENGTH}
      animatedProps={props}
      stroke={BODY}
      strokeWidth={width}
      strokeLinecap="round"
    />
  );
}

function ArmSegment({ seg, swing, design, team }: { seg: Seg; swing: SharedValue<number>; design: Design; team: string }) {
  const { x, y } = design.shoulder;
  const props = useAnimatedProps(() => {
    const a = rotate(seg.x1, seg.y1, x, y, swing.value);
    const b = rotate(seg.x2, seg.y2, x, y, swing.value);
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  });
  const color = seg.color === 'team' ? team : (seg.color ?? BODY);
  return (
    <ALine
      x1={seg.x1}
      y1={seg.y1}
      x2={seg.x2}
      y2={seg.y2}
      animatedProps={props}
      stroke={color}
      strokeWidth={seg.width ?? design.lineWidth}
      strokeLinecap={seg.width && seg.width > 8 ? 'butt' : 'round'}
    />
  );
}

function Orb({ orb, swing, design }: { orb: NonNullable<Design['orb']>; swing: SharedValue<number>; design: Design }) {
  const { x, y } = design.shoulder;
  const props = useAnimatedProps(() => {
    const p = rotate(orb.x, orb.y, x, y, swing.value);
    return { cx: p.x, cy: p.y };
  });
  return <ACircle cx={orb.x} cy={orb.y} r={orb.r} animatedProps={props} fill="#afa9ec" stroke="#cecbf6" strokeWidth={2} />;
}

interface Props {
  type: UnitType;
  teamColor: string;
  size: number;
  /** Legs move while true */
  walking?: boolean;
  /** Changes on every hit (the unit's lastHitTick); each change plays one weapon swing */
  attackTick?: number;
  /** false = a still drawing, e.g. on a card */
  animated?: boolean;
}

function StickmanBase({ type, teamColor, size, walking = false, attackTick = -1, animated = true }: Props) {
  const design = DESIGNS[type];
  const phase = useSharedValue(0); // -1..1, leg swing
  const swing = useSharedValue(0); // degrees, weapon arm

  useEffect(() => {
    if (!animated) return;
    if (walking) {
      const half = design.walkMs / 2;
      phase.value = withSequence(
        withTiming(-1, { duration: half }),
        withRepeat(withTiming(1, { duration: design.walkMs, easing: Easing.inOut(Easing.quad) }), -1, true),
      );
    } else {
      phase.value = withTiming(0, { duration: 120 });
    }
  }, [walking, animated, design.walkMs, phase]);

  useEffect(() => {
    if (!animated || attackTick < 0 || design.swingDeg === 0) return;
    swing.value = withSequence(withTiming(design.swingDeg, { duration: 90 }), withTiming(0, { duration: 200 }));
  }, [attackTick, animated, design.swingDeg, swing]);

  const w = design.lineWidth;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Leg phase={phase} direction={1} width={w} />
      <Leg phase={phase} direction={-1} width={w} />
      <Line x1={50} y1={24 + design.headR} x2={HIP.x} y2={HIP.y} stroke={BODY} strokeWidth={w} strokeLinecap="round" />
      {/* Back arm */}
      <Line x1={design.shoulder.x} y1={design.shoulder.y} x2={36} y2={54} stroke={BODY} strokeWidth={w} strokeLinecap="round" />
      <Circle cx={50} cy={24} r={design.headR} fill={teamColor} stroke={BODY} strokeWidth={3} />
      {design.extras?.(teamColor)}
      {design.arm.map((seg, i) => (
        <ArmSegment key={i} seg={seg} swing={swing} design={design} team={teamColor} />
      ))}
      {design.orb && <Orb orb={design.orb} swing={swing} design={design} />}
    </Svg>
  );
}

export const Stickman = memo(StickmanBase);
