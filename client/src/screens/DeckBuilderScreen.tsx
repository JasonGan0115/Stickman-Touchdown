import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, ScrollView, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { LOADOUT_AUGMENT_SLOTS, LOADOUT_UNIT_SLOTS } from '../game/constants';
import { getServerUrl, socketService } from '../services/SocketService';

// ---------------------------------------------------------------------------
// Data from GET /player/:username/collection
// ---------------------------------------------------------------------------

type Rarity = 'Common' | 'Rare' | 'Legendary';

interface CardData {
  id: string;
  name: string;
  type: string;
  manaCost: number;
}

interface AugmentGrant {
  grantId: string; // PlayerAugment id: one per owned copy
  augmentId: string; // catalog id, what the loadout stores
  name: string;
  rarity: Rarity;
  effectModifier: number;
  effect?: string | null; // e.g. "+10% unit health"
  expiresAt: string;
}

interface Collection {
  username: string;
  cards: CardData[];
  augments: AugmentGrant[];
  loadout: { unitIds: string[]; augmentIds: string[] };
}

type DragItem =
  | { kind: 'unit'; key: string; title: string; subtitle: string }
  | { kind: 'augment'; key: string; title: string; subtitle: string; rarity: Rarity };

type Kind = DragItem['kind'];

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Ghost {
  x: SharedValue<number>; // finger position, window coordinates
  y: SharedValue<number>;
  opacity: SharedValue<number>;
  scale: SharedValue<number>;
}

const RARITY_COLOR: Record<Rarity, string> = { Common: '#b8bec9', Rare: '#4da3ff', Legendary: '#ffb020' };
const TILE_WIDTH = 104;
const TILE_HEIGHT = 58;
const LONG_PRESS_MS = 150; // hold briefly to pick up; a quick swipe still scrolls the list

const inside = (r: Rect | null | undefined, x: number, y: number) =>
  !!r && x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;

const hoursUntil = (iso: string) => Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000));

async function fetchCollection(): Promise<Collection> {
  const username = await socketService.getUsername();
  const res = await fetch(`${getServerUrl()}/player/${encodeURIComponent(username)}/collection`);
  const body = await res.json();
  if (!res.ok || !body.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as Collection;
}

/** Puts a saved loadout into slots. Augments map to owned grants (each grant fills one slot). */
function slotsFromLoadout(data: Collection) {
  const units = Array<string | null>(LOADOUT_UNIT_SLOTS).fill(null);
  data.loadout.unitIds.slice(0, LOADOUT_UNIT_SLOTS).forEach((id, i) => (units[i] = id));

  const augments = Array<string | null>(LOADOUT_AUGMENT_SLOTS).fill(null);
  const usedGrants = new Set<string>();
  data.loadout.augmentIds.slice(0, LOADOUT_AUGMENT_SLOTS).forEach((augmentId, i) => {
    const grant = data.augments.find((g) => g.augmentId === augmentId && !usedGrants.has(g.grantId));
    if (grant) {
      usedGrants.add(grant.grantId);
      augments[i] = grant.grantId;
    }
  });
  return { units, augments };
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

type Status =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'save_error'; message: string };

export function DeckBuilderScreen({ onClose }: { onClose: () => void }) {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  // Unit slots hold Card ids; augment slots hold grant ids (a specific owned copy)
  const [unitSlots, setUnitSlots] = useState<(string | null)[]>(() => Array(LOADOUT_UNIT_SLOTS).fill(null));
  const [augmentSlots, setAugmentSlots] = useState<(string | null)[]>(() => Array(LOADOUT_AUGMENT_SLOTS).fill(null));
  const [dragging, setDragging] = useState<DragItem | null>(null);

  // Drag ghost: rendered at the screen root so it can leave the scrolling list
  const ghost: Ghost = {
    x: useSharedValue(0),
    y: useSharedValue(0),
    opacity: useSharedValue(0),
    scale: useSharedValue(1),
  };
  const rootOffsetX = useSharedValue(0);
  const rootOffsetY = useSharedValue(0);

  // Drop targets, measured in window coordinates (same space as the gesture's absoluteX/Y)
  type ViewRef = ComponentRef<typeof View>;
  const rootRef = useRef<ViewRef>(null);
  const zoneRefs = useRef<Record<Kind, ViewRef | null>>({ unit: null, augment: null });
  const slotRefs = useRef<Record<Kind, (ViewRef | null)[]>>({ unit: [], augment: [] });
  const zoneRects = useRef<Record<Kind, Rect | null>>({ unit: null, augment: null });
  const slotRects = useRef<Record<Kind, (Rect | null)[]>>({ unit: [], augment: [] });

  // ---- Load (re-runs when reloadKey changes, i.e. on Retry) ----
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let cancelled = false; // ignore the response if the screen closed meanwhile
    fetchCollection()
      .then((data) => {
        if (cancelled) return;
        const { units, augments } = slotsFromLoadout(data);
        setCollection(data);
        setUnitSlots(units);
        setAugmentSlots(augments);
        setStatus({ kind: 'ready' });
      })
      .catch((err: unknown) => {
        if (!cancelled) setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // ---- Drag & drop ----
  const measureTargets = useCallback(() => {
    rootRef.current?.measureInWindow((x, y) => {
      rootOffsetX.set(x);
      rootOffsetY.set(y);
    });
    (['unit', 'augment'] as const).forEach((kind) => {
      zoneRefs.current[kind]?.measureInWindow((x, y, width, height) => {
        zoneRects.current[kind] = { x, y, width, height };
      });
      slotRefs.current[kind].forEach((ref, i) =>
        ref?.measureInWindow((x, y, width, height) => {
          slotRects.current[kind][i] = { x, y, width, height };
        }),
      );
    });
  }, [rootOffsetX, rootOffsetY]);

  const onDragStart = useCallback(
    (item: DragItem) => {
      setDragging(item);
      measureTargets(); // re-measure each drag in case the layout moved
    },
    [measureTargets],
  );

  const hideGhost = useCallback(() => {
    ghost.opacity.set(withTiming(0, { duration: 150 }));
    ghost.scale.set(withTiming(0.8, { duration: 150 }));
  }, [ghost.opacity, ghost.scale]);

  const onDrop = useCallback(
    (item: DragItem, x: number, y: number, canceled: boolean) => {
      setDragging(null);
      if (canceled) return hideGhost();

      const slots = item.kind === 'unit' ? unitSlots : augmentSlots;
      let index = slotRects.current[item.kind].findIndex((r) => inside(r, x, y));
      // Dropped on the right zone but between slots: use the first empty slot
      if (index === -1 && inside(zoneRects.current[item.kind], x, y)) index = slots.indexOf(null);
      if (index === -1) return hideGhost(); // dropped elsewhere (or zone full): nothing changes

      const next = slots.map((v) => (v === item.key ? null : v)); // moving an already placed item
      next[index] = item.key;
      (item.kind === 'unit' ? setUnitSlots : setAugmentSlots)(next);
      setStatus({ kind: 'ready' });

      // Glide the ghost into the slot, then fade it
      const r = slotRects.current[item.kind][index];
      if (r) {
        ghost.x.set(withTiming(r.x + r.width / 2, { duration: 120 }));
        ghost.y.set(withTiming(r.y + r.height / 2, { duration: 120 }));
      }
      ghost.opacity.set(withDelay(100, withTiming(0, { duration: 120 })));
      ghost.scale.set(withTiming(0.85, { duration: 200 }));
    },
    [unitSlots, augmentSlots, hideGhost, ghost.x, ghost.y, ghost.opacity, ghost.scale],
  );

  const ghostStyle = useAnimatedStyle(() => ({
    opacity: ghost.opacity.get(),
    transform: [
      { translateX: ghost.x.get() - rootOffsetX.get() - TILE_WIDTH / 2 },
      { translateY: ghost.y.get() - rootOffsetY.get() - TILE_HEIGHT / 2 },
      { scale: ghost.scale.get() },
    ],
  }));

  // ---- Save ----
  const save = async () => {
    if (!collection) return;
    setStatus({ kind: 'saving' });
    const grantToAugment = new Map(collection.augments.map((g) => [g.grantId, g.augmentId]));
    const unitIds = unitSlots.filter((id): id is string => !!id);
    const augmentIds = augmentSlots
      .filter((id): id is string => !!id)
      .map((grantId) => grantToAugment.get(grantId)!)
      .filter(Boolean);
    try {
      const res = await fetch(`${getServerUrl()}/player/loadout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: collection.username, unitIds, augmentIds }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setStatus({ kind: 'saved' });
    } catch (err) {
      setStatus({ kind: 'save_error', message: err instanceof Error ? err.message : String(err) });
    }
  };

  // ---- Render ----
  const cardsById = new Map(collection?.cards.map((c) => [c.id, c]));
  const grantsById = new Map(collection?.augments.map((g) => [g.grantId, g]));
  const placedUnits = new Set(unitSlots.filter(Boolean));
  const placedGrants = new Set(augmentSlots.filter(Boolean));

  const unitItem = (c: CardData): DragItem => ({ kind: 'unit', key: c.id, title: c.name, subtitle: `${c.type} · ${c.manaCost} mana` });
  const augmentItem = (g: AugmentGrant): DragItem => ({
    kind: 'augment',
    key: g.grantId,
    title: g.name,
    subtitle: `${g.effect ?? `×${g.effectModifier}`} · ${hoursUntil(g.expiresAt)}h left`,
    rarity: g.rarity,
  });

  return (
    <View ref={rootRef} style={styles.root} onLayout={measureTargets}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={({ pressed }) => [styles.back, pressed && styles.dimmed]}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Deck Builder</Text>
        <Text style={styles.username}>{collection?.username ?? ''}</Text>
      </View>

      {/* ---- Top half: collection ---- */}
      <View style={styles.half}>
        {status.kind === 'loading' ? (
          <View style={styles.center}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : status.kind === 'error' ? (
          <View style={styles.center}>
            <Text style={styles.error}>Couldn&apos;t load your collection: {status.message}</Text>
            <Pressable
              style={[styles.button, styles.secondary]}
              onPress={() => {
                setStatus({ kind: 'loading' });
                setReloadKey((k) => k + 1);
              }}
            >
              <Text style={styles.buttonText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.sectionTitle}>Unlocked Units · hold & drag</Text>
            <View style={styles.tileGrid}>
              {collection?.cards.map((c) => (
                <DraggableTile
                  key={c.id}
                  item={unitItem(c)}
                  used={placedUnits.has(c.id)}
                  ghost={ghost}
                  onDragStart={onDragStart}
                  onDrop={onDrop}
                />
              ))}
            </View>

            <Text style={styles.sectionTitle}>Active Augments</Text>
            {collection?.augments.length === 0 && (
              <Text style={styles.empty}>No active augments. Win or lose a match to earn some!</Text>
            )}
            <View style={styles.tileGrid}>
              {collection?.augments.map((g) => (
                <DraggableTile
                  key={g.grantId}
                  item={augmentItem(g)}
                  used={placedGrants.has(g.grantId)}
                  ghost={ghost}
                  onDragStart={onDragStart}
                  onDrop={onDrop}
                />
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      {/* ---- Bottom half: drop zones ---- */}
      <View style={styles.half}>
        <Text style={styles.sectionTitle}>
          Units {placedUnits.size}/{LOADOUT_UNIT_SLOTS}
        </Text>
        <View
          ref={(r) => {
            zoneRefs.current.unit = r;
          }}
          style={[styles.zone, dragging?.kind === 'unit' && styles.zoneActive]}
        >
          {unitSlots.map((cardId, i) => {
            const card = cardId ? cardsById.get(cardId) : undefined;
            return (
              <Slot
                key={i}
                setRef={(r) => {
                  slotRefs.current.unit[i] = r;
                }}
                style={styles.unitSlot}
                title={card?.name}
                subtitle={card ? `${card.manaCost} mana` : undefined}
                onClear={() => setUnitSlots((s) => s.map((v, j) => (j === i ? null : v)))}
              />
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>
          Augments {placedGrants.size}/{LOADOUT_AUGMENT_SLOTS}
        </Text>
        <View
          ref={(r) => {
            zoneRefs.current.augment = r;
          }}
          style={[styles.zone, dragging?.kind === 'augment' && styles.zoneActive]}
        >
          {augmentSlots.map((grantId, i) => {
            const grant = grantId ? grantsById.get(grantId) : undefined;
            return (
              <Slot
                key={i}
                setRef={(r) => {
                  slotRefs.current.augment[i] = r;
                }}
                style={styles.augmentSlot}
                title={grant?.name}
                accent={grant ? RARITY_COLOR[grant.rarity] : undefined}
                onClear={() => setAugmentSlots((s) => s.map((v, j) => (j === i ? null : v)))}
              />
            );
          })}
        </View>

        <View style={styles.saveRow}>
          <Text style={styles.saveStatus}>
            {status.kind === 'saved'
              ? 'Loadout saved ✓'
              : status.kind === 'save_error'
                ? `Save failed: ${status.message}`
                : 'Tap a filled slot to empty it'}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.button, (pressed || status.kind === 'saving' || !collection) && styles.dimmed]}
            disabled={status.kind === 'saving' || !collection}
            onPress={() => void save()}
          >
            <Text style={styles.buttonText}>{status.kind === 'saving' ? 'Saving…' : 'Save Loadout'}</Text>
          </Pressable>
        </View>
      </View>

      {/* Drag ghost, above everything */}
      <Animated.View style={[styles.ghost, ghostStyle]}>
        {dragging && <TileContent item={dragging} />}
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

interface DraggableTileProps {
  item: DragItem;
  used: boolean;
  ghost: Ghost;
  onDragStart: (item: DragItem) => void;
  onDrop: (item: DragItem, x: number, y: number, canceled: boolean) => void;
}

/** A collection tile. Hold briefly, then drag; the gesture runs on the UI thread and moves the shared ghost. */
function DraggableTile({ item, used, ghost, onDragStart, onDrop }: DraggableTileProps) {
  const pan = usePanGesture({
    enabled: !used,
    activateAfterLongPress: LONG_PRESS_MS,
    onActivate: (e) => {
      'worklet';
      ghost.x.set(e.absoluteX);
      ghost.y.set(e.absoluteY);
      ghost.scale.set(withSpring(1.08));
      ghost.opacity.set(withTiming(1, { duration: 80 }));
      scheduleOnRN(onDragStart, item);
    },
    onUpdate: (e) => {
      'worklet';
      ghost.x.set(e.absoluteX);
      ghost.y.set(e.absoluteY);
    },
    onDeactivate: (e) => {
      'worklet';
      scheduleOnRN(onDrop, item, e.absoluteX, e.absoluteY, e.canceled);
    },
  });

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.tile, used && styles.tileUsed]}>
        <TileContent item={item} />
      </View>
    </GestureDetector>
  );
}

function TileContent({ item }: { item: DragItem }) {
  return (
    <View style={[styles.tileInner, item.kind === 'augment' && { borderColor: RARITY_COLOR[item.rarity] }]}>
      <Text style={styles.tileTitle} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={styles.tileSubtitle} numberOfLines={1}>
        {item.subtitle}
      </Text>
    </View>
  );
}

function Slot({
  setRef,
  style,
  title,
  subtitle,
  accent,
  onClear,
}: {
  setRef: (r: ComponentRef<typeof View> | null) => void;
  style: object;
  title?: string;
  subtitle?: string;
  accent?: string;
  onClear: () => void;
}) {
  return (
    <View ref={setRef} style={style}>
      <Pressable
        disabled={!title}
        onPress={onClear}
        style={[styles.slotInner, title ? styles.slotFilled : null, accent ? { borderColor: accent } : null]}
      >
        {title ? (
          <>
            <Text style={styles.slotTitle} numberOfLines={2}>
              {title}
            </Text>
            {subtitle && <Text style={styles.slotSubtitle}>{subtitle}</Text>}
          </>
        ) : (
          <Text style={styles.slotEmpty}>+</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignSelf: 'stretch' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 },
  back: { paddingVertical: 6, paddingRight: 12 },
  backText: { color: '#8fb4ff', fontSize: 16, fontWeight: '700' },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  username: { color: '#8a8f9c', fontSize: 12, minWidth: 60, textAlign: 'right' },
  half: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  error: { color: '#ff8a8a', textAlign: 'center' },
  empty: { color: '#8a8f9c', fontSize: 13, marginBottom: 8 },
  scrollContent: { paddingBottom: 16 },
  sectionTitle: { color: '#c9ccd4', fontSize: 13, fontWeight: '800', letterSpacing: 0.5, marginVertical: 6 },

  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: TILE_WIDTH, height: TILE_HEIGHT },
  tileUsed: { opacity: 0.3 },
  tileInner: {
    flex: 1,
    backgroundColor: '#262a35',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#3b6cff',
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  tileTitle: { color: '#fff', fontSize: 13, fontWeight: '800' },
  tileSubtitle: { color: '#a9aebb', fontSize: 11 },

  zone: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#3a3d46',
  },
  zoneActive: { borderColor: '#3ddc84', backgroundColor: 'rgba(61,220,132,0.08)' },
  unitSlot: { width: '23.5%', height: 56 },
  augmentSlot: { width: '23.5%', height: 40 },
  slotInner: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a3d46',
    backgroundColor: '#181b22',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  slotFilled: { backgroundColor: '#262a35', borderColor: '#3b6cff', borderWidth: 2 },
  slotTitle: { color: '#fff', fontSize: 11, fontWeight: '800', textAlign: 'center' },
  slotSubtitle: { color: '#a9aebb', fontSize: 10 },
  slotEmpty: { color: '#3a3d46', fontSize: 20, fontWeight: '800' },

  saveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 8, gap: 8 },
  saveStatus: { color: '#c9ccd4', fontSize: 12, flex: 1 },
  button: { backgroundColor: '#3b6cff', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  secondary: { backgroundColor: '#3a3d46' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  dimmed: { opacity: 0.5 },

  ghost: { position: 'absolute', left: 0, top: 0, width: TILE_WIDTH, height: TILE_HEIGHT, pointerEvents: 'none' },
});
