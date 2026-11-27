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

  const handleRankedQueue = () => {
    soundService.playWhistle();
    service.joinQueue('standard');
  };

  const handleAiPractice = () => {
    soundService.playWhistle();
    service.playVsAi(false, aiLevel);
  };

  const handleAiSpectate = () => {
    soundService.playSpawn();
    service.playVsAi(true, aiLevel);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {/* Player Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>🏈 TOUCHDOWN PVP</Text>
        <View style={styles.headerBadges}>
          <View style={styles.userBadge}>
            <Text style={[styles.statusDot, { color: isConnected ? '#2e9e5b' : '#c0392b' }]}>●</Text>
            <Text style={styles.usernameText}>
              {isConnected
                ? username ?? 'Player'
                : reconnectInSec !== null && reconnectInSec > 0
                  ? `Connecting to Server… (${reconnectInSec}s)`
                  : 'Connecting to Server…'}
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

      {/* Deck Status Pill */}
      <Pressable
        style={({ pressed }) => [styles.deckStatusCard, pressed && styles.dimmed]}
        onPress={() => onSelectTab('deck')}
      >
        <View style={styles.deckStatusLeft}>
          <Text style={styles.deckStatusIcon}>🃏</Text>
          <View>
            <Text style={styles.deckStatusTitle}>Active Loadout: 8 / 8 Troops</Text>
            <Text style={styles.deckStatusSub}>Deck configured · Clash-style card cycling active</Text>
          </View>
        </View>
        <Text style={styles.editDeckButtonText}>Edit ›</Text>
      </Pressable>

      {/* Ranked Mode Featured Card */}
      <View style={styles.modeCard}>
        <View style={styles.modeCardHeader}>
          <Text style={styles.modeIcon}>⚡</Text>
          <View style={styles.modeHeaderText}>
            <Text style={styles.modeTitle}>1v1 RANKED GRIDIRON</Text>
            <Text style={styles.modeSub}>First to 3 Touchdowns · Real-time PvP</Text>
          </View>
        </View>

        <View style={styles.modeSpecsRow}>
          <View style={styles.specItem}>
            <Text style={styles.specLabel}>LIQUID</Text>
            <Text style={styles.specValue}>3 Start · +1/s</Text>
          </View>
          <View style={styles.specItem}>
            <Text style={styles.specLabel}>COOLDOWN</Text>
            <Text style={styles.specValue}>1.0s Global</Text>
          </View>
          <View style={styles.specItem}>
            <Text style={styles.specLabel}>AUGMENT</Text>
            <Text style={styles.specValue}>Silver Draft</Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.playButton,
            (!isConnected || pressed) && styles.dimmed,
          ]}
          disabled={!isConnected}
          onPress={handleRankedQueue}
        >
          <Text style={styles.playButtonText}>
            {isConnected ? 'FIND RANKED MATCH' : 'CONNECTING…'}
          </Text>
        </Pressable>
      </View>

      {/* Weekly Tournament Spotlight */}
      <Pressable
        style={({ pressed }) => [styles.tournamentBanner, pressed && styles.dimmed]}
        onPress={() => onSelectTab('tournament')}
      >
        <View style={styles.tournamentBannerTop}>
          <Text style={styles.tournamentTrophyIcon}>🏆</Text>
          <View style={styles.tournamentBannerText}>
            <Text style={styles.tournamentBannerTitle}>WEEKLY TOURNAMENT</Text>
            <Text style={styles.tournamentBannerSub}>Mirror match bracket · Equal decks & mana</Text>
          </View>
        </View>
        <View style={styles.tournamentActionRow}>
          <Text style={styles.tournamentRewardText}>+100 XP & Vault Augment</Text>
          <Text style={styles.tournamentEnterLink}>View Bracket & Enter ›</Text>
        </View>
      </Pressable>

      {/* AI Practice Section */}
      <View style={styles.practiceSection}>
        <View style={styles.practiceHeaderRow}>
          <Text style={styles.sectionHeader}>🤖 VS AI CHALLENGE (100 LEVELS)</Text>
          <Text style={styles.clearedCountText}>Cleared: {clearedLevels.length}/100</Text>
        </View>
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
              <Text style={styles.levelValue}>Lv. {aiLevel} / 100</Text>
              <View style={styles.levelMetaRow}>
                <Text style={styles.levelTier}>{aiTierLabel(aiLevel)}</Text>
                {clearedLevels.includes(aiLevel) && (
                  <Text style={styles.levelClearedBadge}>✓ CLEARED</Text>
                )}
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
        <View style={styles.aiButtonsRow}>
          <Pressable
            style={({ pressed }) => [styles.aiButton, pressed && styles.dimmed]}
            disabled={!isConnected}
            onPress={handleAiPractice}
          >
            <Text style={styles.aiButtonIcon}>🎮</Text>
            <Text style={styles.aiButtonText}>Play vs AI · Lv.{aiLevel}</Text>
          </Pressable>

          {__DEV__ && (
            <Pressable
              style={({ pressed }) => [styles.aiButton, styles.aiSpectateButton, pressed && styles.dimmed]}
              disabled={!isConnected}
              onPress={handleAiSpectate}
            >
              <Text style={styles.aiButtonIcon}>👁️</Text>
              <Text style={styles.aiButtonText}>Watch AI vs AI</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Pro Tips Section */}
      <View style={styles.tipsCard}>
        <Text style={styles.tipsHeader}>💡 GRIDIRON TACTICAL TIPS</Text>
        <Text style={styles.tipText}>
          • <Text style={styles.tipBold}>Flying Units:</Text> Sticky Bat & Glue Bomber fly above ground melee troops. Target them with Archers or Spitfire Wasps!
        </Text>
        <Text style={styles.tipText}>
          • <Text style={styles.tipBold}>Touchdown Reset:</Text> Scoring wipes the field and gives both coaches 5 Sticky Liquid. Don&apos;t overspend right before scoring.
        </Text>
        <Text style={styles.tipText}>
          • <Text style={styles.tipBold}>Comeback Draft:</Text> Conceding a touchdown immediately unlocks a Gold or Legendary augment pick!
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, alignSelf: 'stretch' },
  container: { padding: 16, paddingBottom: 40, gap: 14, alignItems: 'center' },
  header: { alignItems: 'center', gap: 6, marginVertical: 4 },
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

  deckStatusCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1c2230',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  deckStatusLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deckStatusIcon: { fontSize: 24 },
  deckStatusTitle: { color: '#fff', fontSize: 13, fontWeight: '800' },
  deckStatusSub: { color: '#8a8f9c', fontSize: 11, marginTop: 1 },
  editDeckButtonText: { color: '#38bdf8', fontSize: 13, fontWeight: '800' },

  modeCard: {
    width: '100%',
    backgroundColor: '#1c202a',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 14,
  },
  modeCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modeIcon: { fontSize: 26 },
  modeHeaderText: { flex: 1 },
  modeTitle: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  modeSub: { color: '#8a8f9c', fontSize: 11, marginTop: 2 },

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

  playButton: {
    backgroundColor: '#3b6cff',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b6cff',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  playButtonText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1 },

  tournamentBanner: {
    width: '100%',
    backgroundColor: 'rgba(255, 176, 32, 0.1)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#ffb020',
    gap: 10,
  },
  tournamentBannerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tournamentTrophyIcon: { fontSize: 28 },
  tournamentBannerText: { flex: 1 },
  tournamentBannerTitle: { color: '#ffb020', fontSize: 15, fontWeight: '900', letterSpacing: 1 },
  tournamentBannerSub: { color: '#d8c290', fontSize: 11, marginTop: 2 },
  tournamentActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 176, 32, 0.2)',
    paddingTop: 8,
  },
  tournamentRewardText: { color: '#06d6a0', fontSize: 11, fontWeight: '800' },
  tournamentEnterLink: { color: '#ffb020', fontSize: 12, fontWeight: '800' },

  practiceSection: { width: '100%', gap: 8 },
  practiceHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHeader: { color: '#8a8f9c', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  clearedCountText: { color: '#06d6a0', fontSize: 11, fontWeight: '800' },
  levelCard: {
    backgroundColor: '#1d202b',
    borderRadius: 12,
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
    backgroundColor: '#2a2e3f',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 40,
    alignItems: 'center',
  },
  levelStepText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  levelDisplay: { flex: 1, alignItems: 'center' },
  levelValue: { color: '#fff', fontSize: 15, fontWeight: '900', fontVariant: ['tabular-nums'] },
  levelMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
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
  aiButtonsRow: { flexDirection: 'row', gap: 10 },
  aiButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#534ab7',
    borderRadius: 12,
    paddingVertical: 12,
  },
  aiSpectateButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#7f77dd',
  },
  aiButtonIcon: { fontSize: 16 },
  aiButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  tipsCard: {
    width: '100%',
    backgroundColor: '#171922',
    borderRadius: 14,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  tipsHeader: { color: '#ffb020', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  tipText: { color: '#9aa0ad', fontSize: 11, lineHeight: 17 },
  tipBold: { color: '#fff', fontWeight: '700' },

  dimmed: { opacity: 0.5 },
});
