import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from 'zustand';

import type { SocketService } from '../services/SocketService';
import type { AugmentReward, GameOverInfo, GameStore } from '../store/useGameStore';

const RESULT_STYLE: Record<GameOverInfo['result'], { title: string; color: string }> = {
  victory: { title: 'VICTORY', color: '#3ddc84' },
  defeat: { title: 'DEFEAT', color: '#ff5c5c' },
  draw: { title: 'DRAW', color: '#c9ccd4' },
};

const REASON_TEXT: Record<GameOverInfo['reason'], string> = {
  score_limit: 'First to 3 touchdowns',
  time_up: "Time's up",
  forfeit: 'Opponent left the match',
  debug_force_win: 'Forced win (debug)',
};

const RARITY_COLOR: Record<AugmentReward['rarity'], string> = {
  Common: '#b8bec9',
  Rare: '#4da3ff',
  Legendary: '#ffb020',
};

function hoursUntil(iso: string): number {
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000));
}

interface Props {
  store: GameStore;
  service: SocketService;
  compact?: boolean;
}

export function PostMatchScreen({ store, service, compact = false }: Props) {
  const gameOver = useStore(store, (s) => s.gameOver);
  const results = useStore(store, (s) => s.matchResults);
  const ai = useStore(store, (s) => s.ai);
  if (!gameOver) return null;

  const { title, color } = RESULT_STYLE[gameOver.result];

  return (
    <View style={styles.container}>
      {gameOver.mode === 'tournament' && <Text style={styles.mode}>WEEKLY TOURNAMENT · MIRROR MATCH</Text>}
      <Text style={[styles.title, compact && styles.titleCompact, { color }]}>{title}</Text>
      <Text style={styles.reason}>{REASON_TEXT[gameOver.reason] ?? gameOver.reason}</Text>
      <Text style={styles.score}>
        {gameOver.finalScore.you} – {gameOver.finalScore.opponent}
      </Text>
      <Text style={styles.vs}>vs {gameOver.opponentName}</Text>

      <View style={styles.rewards}>
        {gameOver.practice ? (
          <Text style={styles.note}>Practice match vs AI: no rewards.</Text>
        ) : gameOver.result === 'draw' ? (
          <Text style={styles.note}>No rewards for a draw.</Text>
        ) : !results ? (
          // 'game_over' arrives instantly; rewards follow once the database writes finish
          <View style={styles.pending}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.note}>Calculating rewards…</Text>
          </View>
        ) : results.rewards ? (
          <>
            <Text style={styles.xp}>
              +{results.rewards.xpGained} XP <Text style={styles.xpTotal}>(total {results.rewards.totalXp})</Text>
            </Text>
            {results.rewards.augment ? (
              <View style={[styles.augment, { borderColor: RARITY_COLOR[results.rewards.augment.rarity] }]}>
                <Text style={[styles.rarity, { color: RARITY_COLOR[results.rewards.augment.rarity] }]}>
                  {results.rewards.augment.rarity.toUpperCase()} AUGMENT
                </Text>
                <Text style={styles.augmentName}>{results.rewards.augment.name}</Text>
                <Text style={styles.augmentMeta}>
                  {results.rewards.augment.effect ?? `×${results.rewards.augment.effectModifier}`} · expires in{' '}
                  {hoursUntil(results.rewards.augment.expiresAt)}h
                </Text>
              </View>
            ) : (
              <Text style={styles.note}>No augment available to mint (has the database been seeded?)</Text>
            )}
          </>
        ) : (
          <Text style={styles.note}>{results.rewardsError ?? 'No rewards.'}</Text>
        )}
      </View>

      <View style={styles.buttons}>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.dimmed]}
          onPress={() => (ai ? service.playVsAi(ai.autoplay) : service.joinQueue(gameOver.mode))}
        >
          <Text style={styles.buttonText}>Play Again</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.dimmed]}
          onPress={() => store.getState().reset()}
        >
          <Text style={styles.buttonText}>Lobby</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  mode: { color: '#ffb020', fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  title: { fontSize: 52, fontWeight: '900', letterSpacing: 2 },
  titleCompact: { fontSize: 34 },
  reason: { color: '#c9ccd4', fontSize: 15 },
  score: { color: '#fff', fontSize: 36, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 4 },
  vs: { color: '#8a8f9c', fontSize: 14 },
  rewards: { alignItems: 'center', gap: 10, marginVertical: 14, minHeight: 60, justifyContent: 'center' },
  pending: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  xp: { color: '#fff', fontSize: 22, fontWeight: '800' },
  xpTotal: { color: '#8a8f9c', fontSize: 14, fontWeight: '600' },
  augment: { borderWidth: 2, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 20, alignItems: 'center', backgroundColor: '#1d2029' },
  rarity: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  augmentName: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 2 },
  augmentMeta: { color: '#c9ccd4', fontSize: 13, marginTop: 2 },
  note: { color: '#c9ccd4', fontSize: 14, textAlign: 'center', maxWidth: 280 },
  buttons: { flexDirection: 'row', gap: 12 },
  button: { backgroundColor: '#3b6cff', paddingVertical: 12, paddingHorizontal: 28, borderRadius: 14 },
  secondary: { backgroundColor: '#3a3d46' },
  dimmed: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
