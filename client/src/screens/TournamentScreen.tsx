import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from 'zustand';

import type { SocketService } from '../services/SocketService';
import type { GameStore } from '../store/useGameStore';

interface Props {
  store: GameStore;
  service: SocketService;
  onEnterQueue?: () => void;
}

export function TournamentScreen({ store }: Props) {
  const username = useStore(store, (s) => s.username);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {/* Header Banner */}
      <View style={styles.header}>
        <View style={styles.heroBadge}>
          <Text style={styles.heroIcon}>⏳</Text>
        </View>
        <Text style={styles.title}>COMING SOON</Text>
        <Text style={styles.subtitle}>NEXT UP IN TOUCHDOWN PVP</Text>
      </View>

      {/* 1v1 Ranked Gridiron Preview */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardIcon}>⚡</Text>
            <View>
              <Text style={styles.cardTitle}>1v1 RANKED GRIDIRON</Text>
              <Text style={styles.cardSub}>First to 3 Touchdowns · Real-time PvP</Text>
            </View>
          </View>
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonText}>COMING SOON</Text>
          </View>
        </View>

        <View style={styles.specsRow}>
          <View style={styles.specItem}>
            <Text style={styles.specLabel}>LIQUID</Text>
            <Text style={styles.specValue}>3 Start · 0.5/s</Text>
          </View>
          <View style={styles.specItem}>
            <Text style={styles.specLabel}>COOLDOWN</Text>
            <Text style={styles.specValue}>1.0s Global</Text>
          </View>
          <View style={styles.specItem}>
            <Text style={styles.specLabel}>AUGMENTS</Text>
            <Text style={styles.specValue}>Gold / Epic / Leg.</Text>
          </View>
        </View>

        <Text style={styles.cardDesc}>
          Climb the live 1v1 ladder against real coaches with your custom 8-card deck, 3s kickoff scouting, and
          between-round augment drafts.
        </Text>

        <Pressable style={[styles.disabledButton, styles.disabledRanked]} disabled>
          <Text style={styles.disabledButtonText}>RANKED QUEUE · COMING SOON</Text>
        </Pressable>
      </View>

      {/* Weekly Mirror Tournament Preview */}
      <View style={[styles.card, styles.tournamentCard]}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardIcon}>🏆</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, styles.goldText]}>WEEKLY MIRROR TOURNAMENT</Text>
              <Text style={styles.cardSub}>8-Player Single-Elimination Bracket</Text>
            </View>
          </View>
          <View style={[styles.comingSoonBadge, styles.goldBadge]}>
            <Text style={[styles.comingSoonText, styles.goldBadgeText]}>COMING SOON</Text>
          </View>
        </View>

        <View style={styles.rulesList}>
          <View style={styles.ruleItem}>
            <Text style={styles.ruleIcon}>🪞</Text>
            <View style={styles.ruleTextWrap}>
              <Text style={styles.ruleTitle}>Identical Mirror Decks</Text>
              <Text style={styles.ruleDesc}>
                Both players use the exact same 8-card loadout & cycle. Pure tactical execution.
              </Text>
            </View>
          </View>
          <View style={styles.ruleItem}>
            <Text style={styles.ruleIcon}>⚡</Text>
            <View style={styles.ruleTextWrap}>
              <Text style={styles.ruleTitle}>Escalating Round Drafts</Text>
              <Text style={styles.ruleDesc}>
                Silver at kickoff; round winners draft Gold and round losers draft Epic → Legendary.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.bracketPreview}>
          <View style={styles.bracketPill}>
            <Text style={styles.bracketPillText}>Quarters ({username ?? 'You'})</Text>
          </View>
          <Text style={styles.arrowText}>→</Text>
          <View style={styles.bracketPill}>
            <Text style={styles.bracketPillText}>Semis</Text>
          </View>
          <Text style={styles.arrowText}>→</Text>
          <View style={[styles.bracketPill, styles.bracketChamp]}>
            <Text style={styles.bracketChampText}>🏆 Finals</Text>
          </View>
        </View>

        <Pressable style={styles.disabledButton} disabled>
          <Text style={styles.disabledButtonText}>TOURNAMENT QUEUE · COMING SOON</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, alignSelf: 'stretch' },
  container: { padding: 16, paddingBottom: 40, gap: 16, alignItems: 'center' },
  header: { alignItems: 'center', gap: 4, marginVertical: 6 },
  heroBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroIcon: { fontSize: 28 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 1.2 },
  subtitle: { color: '#38bdf8', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },

  card: {
    width: '100%',
    backgroundColor: '#1c202a',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 12,
  },
  tournamentCard: {
    borderColor: 'rgba(255, 176, 32, 0.3)',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  cardIcon: { fontSize: 24 },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.6 },
  goldText: { color: '#ffb020' },
  cardSub: { color: '#8a8f9c', fontSize: 11, marginTop: 1 },
  comingSoonBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  comingSoonText: { color: '#38bdf8', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  goldBadge: {
    backgroundColor: 'rgba(255, 176, 32, 0.14)',
    borderColor: 'rgba(255, 176, 32, 0.45)',
  },
  goldBadgeText: { color: '#ffb020' },

  specsRow: {
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

  cardDesc: { color: '#9aa0ad', fontSize: 12, lineHeight: 17 },

  rulesList: { gap: 10 },
  ruleItem: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  ruleIcon: { fontSize: 18, marginTop: 1 },
  ruleTextWrap: { flex: 1, gap: 2 },
  ruleTitle: { color: '#fff', fontSize: 12, fontWeight: '800' },
  ruleDesc: { color: '#9aa0ad', fontSize: 11, lineHeight: 16 },

  bracketPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#14161f',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  bracketPill: {
    backgroundColor: '#232836',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  bracketPillText: { color: '#c9ccd4', fontSize: 10, fontWeight: '700' },
  bracketChamp: {
    backgroundColor: 'rgba(255, 176, 32, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 176, 32, 0.4)',
  },
  bracketChampText: { color: '#ffb020', fontSize: 10, fontWeight: '900' },
  arrowText: { color: '#606470', fontSize: 12, fontWeight: '900' },

  disabledButton: {
    width: '100%',
    backgroundColor: '#262b38',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  disabledRanked: {
    backgroundColor: '#222838',
  },
  disabledButtonText: { color: '#8a8f9c', fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
});
