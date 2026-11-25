import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from 'zustand';

import type { SocketService } from '../services/SocketService';
import { soundService } from '../services/SoundService';
import type { GameStore } from '../store/useGameStore';

interface Props {
  store: GameStore;
  service: SocketService;
  onEnterQueue?: () => void;
}

function getWeeklyResetTime(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0 is Sunday, 1 is Monday
  const daysUntilMonday = ((8 - day) % 7) || 7;
  const nextMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday));
  const diff = nextMonday.getTime() - now.getTime();
  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const m = Math.floor((diff / (1000 * 60)) % 60);
  return `${d}d ${h}h ${m}m`;
}

export function TournamentScreen({ store, service, onEnterQueue }: Props) {
  const isConnected = useStore(store, (s) => s.isConnected);
  const username = useStore(store, (s) => s.username);
  const [timeLeft, setTimeLeft] = useState(getWeeklyResetTime);

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(getWeeklyResetTime()), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleEnter = () => {
    soundService.playWhistle();
    service.joinQueue('tournament');
    onEnterQueue?.();
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {/* Header Banner */}
      <View style={styles.header}>
        <View style={styles.trophyBadge}>
          <Text style={styles.trophyIcon}>🏆</Text>
        </View>
        <Text style={styles.title}>WEEKLY TOURNAMENT</Text>
        <Text style={styles.subtitle}>MIRROR MATCH CHAMPIONSHIP</Text>
        <View style={styles.resetTimerBadge}>
          <Text style={styles.resetTimerLabel}>RESET IN: </Text>
          <Text style={styles.resetTimerValue}>{timeLeft}</Text>
        </View>
      </View>

      {/* Rules Card */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>⚔ TOURNAMENT RULES</Text>
        <View style={styles.ruleItem}>
          <Text style={styles.ruleIcon}>🪞</Text>
          <View style={styles.ruleTextWrap}>
            <Text style={styles.ruleTitle}>Identical Mirror Decks</Text>
            <Text style={styles.ruleDesc}>Both players use the exact same 8-troop loadout & cycle. No pay-to-win, 100% tactical skill.</Text>
          </View>
        </View>
        <View style={styles.ruleItem}>
          <Text style={styles.ruleIcon}>⚡</Text>
          <View style={styles.ruleTextWrap}>
            <Text style={styles.ruleTitle}>Silver Draft & Comeback Boosts</Text>
            <Text style={styles.ruleDesc}>Draft a Silver augment at kickoff. Conceding player gets a Gold or Legendary augment pick.</Text>
          </View>
        </View>
        <View style={styles.ruleItem}>
          <Text style={styles.ruleIcon}>🏈</Text>
          <View style={styles.ruleTextWrap}>
            <Text style={styles.ruleTitle}>First to 3 Touchdowns</Text>
            <Text style={styles.ruleDesc}>2-second placement cooldown, 1 liquid/sec regen, 5 liquid pitch reset after each score.</Text>
          </View>
        </View>
      </View>

      {/* Bracket Preview */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>📊 8-PLAYER BRACKET</Text>
        <Text style={styles.bracketSub}>Single Elimination · Real-time matchmaking</Text>

        <View style={styles.bracketContainer}>
          {/* Quarterfinals */}
          <View style={styles.bracketColumn}>
            <Text style={styles.roundLabel}>QUARTERS</Text>
            <View style={styles.matchBox}>
              <Text style={[styles.playerText, styles.highlightPlayer]}>{username ?? 'YOU'}</Text>
              <Text style={styles.playerText}>Challenger 1</Text>
            </View>
            <View style={styles.matchBox}>
              <Text style={styles.playerText}>Challenger 2</Text>
              <Text style={styles.playerText}>Challenger 3</Text>
            </View>
          </View>

          {/* Bracket Divider */}
          <View style={styles.bracketDivider}>
            <Text style={styles.arrowText}>→</Text>
          </View>

          {/* Semifinals */}
          <View style={styles.bracketColumn}>
            <Text style={styles.roundLabel}>SEMIS</Text>
            <View style={[styles.matchBox, styles.semiMatchBox]}>
              <Text style={styles.playerPlaceholder}>Winner QF1</Text>
              <Text style={styles.playerPlaceholder}>Winner QF2</Text>
            </View>
          </View>

          {/* Bracket Divider */}
          <View style={styles.bracketDivider}>
            <Text style={styles.arrowText}>→</Text>
          </View>

          {/* Finals */}
          <View style={styles.bracketColumn}>
            <Text style={styles.roundLabel}>FINALS</Text>
            <View style={[styles.matchBox, styles.finalMatchBox]}>
              <Text style={styles.trophySmall}>🏆</Text>
              <Text style={styles.championLabel}>CHAMPION</Text>
              <Text style={styles.rewardText}>+100 XP & Vault Augment</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Enter Tournament Button */}
      <Pressable
        style={({ pressed }) => [
          styles.enterButton,
          (!isConnected || pressed) && styles.dimmed,
        ]}
        disabled={!isConnected}
        onPress={handleEnter}
      >
        <Text style={styles.enterButtonText}>
          {isConnected ? 'ENTER TOURNAMENT QUEUE' : 'CONNECTING TO SERVER…'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, alignSelf: 'stretch' },
  container: { padding: 16, paddingBottom: 40, gap: 14, alignItems: 'center' },
  header: { alignItems: 'center', gap: 4, marginVertical: 8 },
  trophyBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ffb020',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    shadowColor: '#ffb020',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  trophyIcon: { fontSize: 32 },
  title: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  subtitle: { color: '#ffb020', fontSize: 13, fontWeight: '800', letterSpacing: 1.5 },
  resetTimerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2430',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  resetTimerLabel: { color: '#8a8f9c', fontSize: 11, fontWeight: '800' },
  resetTimerValue: { color: '#06d6a0', fontSize: 12, fontWeight: '900' },

  card: {
    width: '100%',
    backgroundColor: '#1c202a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 12,
  },
  cardHeader: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  bracketSub: { color: '#8a8f9c', fontSize: 11, marginTop: -6 },

  ruleItem: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  ruleIcon: { fontSize: 20, marginTop: 2 },
  ruleTextWrap: { flex: 1, gap: 2 },
  ruleTitle: { color: '#fff', fontSize: 13, fontWeight: '700' },
  ruleDesc: { color: '#9aa0ad', fontSize: 11, lineHeight: 16 },

  bracketContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingVertical: 8,
  },
  bracketColumn: { flex: 1, gap: 8, alignItems: 'center' },
  roundLabel: { color: '#ffb020', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  matchBox: {
    width: '100%',
    backgroundColor: '#14161f',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 4,
  },
  semiMatchBox: { marginVertical: 18 },
  finalMatchBox: {
    backgroundColor: 'rgba(255, 176, 32, 0.12)',
    borderColor: '#ffb020',
    alignItems: 'center',
    paddingVertical: 12,
  },
  playerText: { color: '#c9ccd4', fontSize: 11, fontWeight: '600' },
  highlightPlayer: { color: '#38bdf8', fontWeight: '800' },
  playerPlaceholder: { color: '#606470', fontSize: 10, fontStyle: 'italic' },
  trophySmall: { fontSize: 20 },
  championLabel: { color: '#ffb020', fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 2 },
  rewardText: { color: '#06d6a0', fontSize: 9, fontWeight: '700', textAlign: 'center', marginTop: 2 },

  bracketDivider: { paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  arrowText: { color: 'rgba(255,255,255,0.3)', fontSize: 16, fontWeight: '900' },

  enterButton: {
    width: '100%',
    backgroundColor: '#ffb020',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#ffb020',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  enterButtonText: { color: '#1a1200', fontSize: 15, fontWeight: '900', letterSpacing: 1 },
  dimmed: { opacity: 0.5 },
});
