import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from 'zustand';

import { AI_LEVEL_STORAGE_KEY, getClearedAiLevels } from '../services/aiProgress';
import type { SocketService } from '../services/SocketService';
import { soundService } from '../services/SoundService';
import type { GameStore } from '../store/useGameStore';

function aiTierLabel(level: number): string {
  if (level <= 25) return 'Rookie';
  if (level <= 50) return 'Pro';
  if (level <= 75) return 'All-Star';
  return 'Legend';
}

interface Props {
  store: GameStore;
  service: SocketService;
  onSelectTab: (tab: 'home' | 'deck' | 'tournament') => void;
}

export function HomeScreen({ store, service, onSelectTab }: Props) {
  const isConnected = useStore(store, (s) => s.isConnected);
  const username = useStore(store, (s) => s.username);
  const onlineCount = useStore(store, (s) => s.onlineCount);
  const totalTesters = useStore(store, (s) => s.totalTesters);
  const reconnectInSec = useStore(store, (s) => s.reconnectInSec);
  const [aiLevel, setAiLevel] = useState(1);
  const [clearedLevels, setClearedLevels] = useState<number[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(AI_LEVEL_STORAGE_KEY)
      .then((saved) => {
        const parsed = saved ? Number(saved) : NaN;
        if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 100) {
          setAiLevel(parsed);
        }
      })
      .catch(() => {});
    void getClearedAiLevels().then(setClearedLevels);
  }, []);

  const updateAiLevel = (next: number) => {
    const clamped = Math.min(100, Math.max(1, next));
    setAiLevel(clamped);
    AsyncStorage.setItem(AI_LEVEL_STORAGE_KEY, String(clamped)).catch(() => {});
  };

  const handleAiPractice = () => {
    soundService.playWhistle();
    service.playVsAi(false, aiLevel);
  };

  const handleAiSpectate = () => {
    soundService.playSpawn();
    service.playVsAi(true, aiLevel);
  };

  const clearedPct = Math.min(100, Math.round((clearedLevels.length / 100) * 100));

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {/* Compact Brand & Status Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>🏈 TOUCHDOWN PVP</Text>
        <View style={styles.headerBadges}>
          <View style={styles.userBadge}>
            <Text style={[styles.statusDot, { color: isConnected ? '#2e9e5b' : '#c0392b' }]}>●</Text>
            <Text style={styles.usernameText}>
              {isConnected
                ? username ?? 'Player'
                : reconnectInSec !== null && reconnectInSec > 0
                  ? `Connecting… (${reconnectInSec}s)`
                  : 'Connecting…'}
            </Text>
          </View>
          {isConnected && onlineCount !== null && (
            <View style={styles.onlineBadge}>
              <Text style={styles.onlineText}>👥 {onlineCount} online</Text>
            </View>
          )}
          {isConnected && totalTesters !== null && (
            <View style={styles.testersBadge}>
              <Text style={styles.testersText}>🧪 {totalTesters} tested</Text>
            </View>
          )}
        </View>
      </View>

      {/* Hero Card: VS AI Challenge (Levels 1-100) */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroTitleWrap}>
            <Text style={styles.heroEyebrow}>SINGLE-PLAYER CAMPAIGN</Text>
            <Text style={styles.heroTitle}>🤖 VS AI CHALLENGE</Text>
          </View>
          <View style={styles.clearedPill}>
            <Text style={styles.clearedPillText}>{clearedLevels.length}/100</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${clearedPct}%` }]} />
        </View>

        {/* Match Rules Strip */}
        <View style={styles.modeSpecsRow}>
          <View style={styles.specItem}>
            <Text style={styles.specLabel}>LIQUID</Text>
            <Text style={styles.specValue}>3 Start · 0.5/s</Text>
          </View>
          <View style={styles.specItem}>
            <Text style={styles.specLabel}>COOLDOWN</Text>
            <Text style={styles.specValue}>1.0s Global</Text>
          </View>
          <View style={styles.specItem}>
            <Text style={styles.specLabel}>DRAFTS</Text>
            <Text style={styles.specValue}>Silver → Gold/Epic</Text>
          </View>
        </View>

        {/* Level Selector */}
        <View style={styles.levelCard}>
          <View style={styles.levelStepper}>
            <Pressable
              style={({ pressed }) => [styles.levelStepBtn, aiLevel <= 1 && styles.dimmed, pressed && styles.dimmed]}
              disabled={aiLevel <= 1}
              onPress={() => updateAiLevel(aiLevel - 10)}
            >
              <Text style={styles.levelStepText}>-10</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.levelStepBtn, aiLevel <= 1 && styles.dimmed, pressed && styles.dimmed]}
              disabled={aiLevel <= 1}
              onPress={() => updateAiLevel(aiLevel - 1)}
            >
              <Text style={styles.levelStepText}>-1</Text>
            </Pressable>
            <View style={styles.levelDisplay}>
              <Text style={styles.levelValue}>Lv. {aiLevel}</Text>
              <View style={styles.levelMetaRow}>
                <Text style={styles.levelTier}>{aiTierLabel(aiLevel)}</Text>
                {clearedLevels.includes(aiLevel) && <Text style={styles.levelClearedBadge}>✓ CLEARED</Text>}
              </View>
            </View>
            <Pressable
              style={({ pressed }) => [styles.levelStepBtn, aiLevel >= 100 && styles.dimmed, pressed && styles.dimmed]}
              disabled={aiLevel >= 100}
              onPress={() => updateAiLevel(aiLevel + 1)}
            >
              <Text style={styles.levelStepText}>+1</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.levelStepBtn, aiLevel >= 100 && styles.dimmed, pressed && styles.dimmed]}
              disabled={aiLevel >= 100}
              onPress={() => updateAiLevel(aiLevel + 10)}
            >
              <Text style={styles.levelStepText}>+10</Text>
            </Pressable>
          </View>
        </View>

        {/* Primary Play CTA */}
        <Pressable
          style={({ pressed }) => [styles.playButton, (!isConnected || pressed) && styles.dimmed]}
          disabled={!isConnected}
          onPress={handleAiPractice}
        >
          <Text style={styles.playButtonText}>
            {isConnected ? `PLAY VS AI · LV. ${aiLevel}` : 'CONNECTING TO SERVER…'}
          </Text>
        </Pressable>

        {__DEV__ && (
          <Pressable
            style={({ pressed }) => [styles.aiSpectateButton, (!isConnected || pressed) && styles.dimmed]}
            disabled={!isConnected}
            onPress={handleAiSpectate}
          >
            <Text style={styles.aiSpectateText}>👁️ Watch AI vs AI (Lv.{aiLevel})</Text>
          </Pressable>
        )}
      </View>

      {/* Active Loadout Summary Card */}
      <Pressable
        style={({ pressed }) => [styles.deckStatusCard, pressed && styles.dimmed]}
        onPress={() => onSelectTab('deck')}
      >
        <View style={styles.deckStatusLeft}>
          <View style={styles.deckIconWrap}>
            <Text style={styles.deckStatusIcon}>🃏</Text>
          </View>
          <View style={styles.deckTextWrap}>
            <Text style={styles.deckStatusTitle}>Active Loadout · 8 / 8 Cards</Text>
            <Text style={styles.deckStatusSub}>64 Troops, 3 Spells, 2 Towers · All Augments Unlocked</Text>
          </View>
        </View>
        <View style={styles.editDeckPill}>
          <Text style={styles.editDeckButtonText}>Edit ›</Text>
        </View>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, alignSelf: 'stretch' },
  container: { padding: 16, paddingBottom: 40, gap: 16, alignItems: 'center' },
  header: { alignItems: 'center', gap: 8, marginTop: 4 },
  logo: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: 1.5 },
  headerBadges: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1b1f2b',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  onlineBadge: {
    backgroundColor: 'rgba(6, 214, 160, 0.12)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(6, 214, 160, 0.35)',
  },
  onlineText: { color: '#06d6a0', fontSize: 12, fontWeight: '700' },
  testersBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  testersText: { color: '#38bdf8', fontSize: 12, fontWeight: '700' },
  statusDot: { fontSize: 10 },
  usernameText: { color: '#c9ccd4', fontSize: 12, fontWeight: '700' },

  heroCard: {
    width: '100%',
    backgroundColor: '#1c202a',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(83, 74, 183, 0.55)',
    gap: 14,
    shadowColor: '#534ab7',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  heroTitleWrap: { flex: 1, gap: 2 },
  heroEyebrow: { color: '#a5b4fc', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 0.8 },
  clearedPill: {
    backgroundColor: 'rgba(6, 214, 160, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(6, 214, 160, 0.4)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  clearedPillText: { color: '#06d6a0', fontSize: 12, fontWeight: '900', fontVariant: ['tabular-nums'] },

  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 999,
    backgroundColor: '#12141c',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#06d6a0',
    borderRadius: 999,
  },

  modeSpecsRow: {
    flexDirection: 'row',
    backgroundColor: '#14161f',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  specItem: { alignItems: 'center', gap: 2 },
  specLabel: { color: '#8a8f9c', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  specValue: { color: '#06d6a0', fontSize: 11, fontWeight: '800' },

  levelCard: {
    backgroundColor: '#14161f',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  levelStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  levelStepBtn: {
    backgroundColor: '#282d3e',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    minWidth: 42,
    alignItems: 'center',
  },
  levelStepText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  levelDisplay: { flex: 1, alignItems: 'center' },
  levelValue: { color: '#fff', fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'] },
  levelMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  levelTier: { color: '#06d6a0', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  levelClearedBadge: {
    color: '#06d6a0',
    backgroundColor: 'rgba(6, 214, 160, 0.16)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  playButton: {
    backgroundColor: '#5b52d6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5b52d6',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },
  playButtonText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1 },

  aiSpectateButton: {
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(165, 180, 252, 0.35)',
  },
  aiSpectateText: { color: '#c7d2fe', fontSize: 12, fontWeight: '700' },

  deckStatusCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1b202c',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.45)',
    gap: 10,
  },
  deckStatusLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  deckIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deckStatusIcon: { fontSize: 22 },
  deckTextWrap: { flex: 1 },
  deckStatusTitle: { color: '#fff', fontSize: 14, fontWeight: '800' },
  deckStatusSub: { color: '#8a8f9c', fontSize: 11, marginTop: 2 },
  editDeckPill: {
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editDeckButtonText: { color: '#38bdf8', fontSize: 13, fontWeight: '800' },

  dimmed: { opacity: 0.5 },
});
