import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from 'zustand';

import { ArenaScreen } from '../screens/ArenaScreen';
import { PostMatchScreen } from '../screens/PostMatchScreen';
import type { SocketService } from '../services/SocketService';
import type { GameStore } from '../store/useGameStore';

interface Props {
  service: SocketService;
  store: GameStore;
  /** Shown above the panel, e.g. "Client A". Setting it also shows the debug controls. */
  label?: string;
  /** Smaller layout so two panels fit on one screen */
  compact?: boolean;
}

/**
 * Everything for ONE client: lobby → arena → post-match.
 * Owns its connection: connects on mount, disconnects on unmount.
 */
export function MatchPanel({ service, store, label, compact = false }: Props) {
  const isConnected = useStore(store, (s) => s.isConnected);
  const username = useStore(store, (s) => s.username);
  const matchStatus = useStore(store, (s) => s.matchStatus);
  const queueMode = useStore(store, (s) => s.queueMode);
  const debugFlipView = useStore(store, (s) => s.debugFlipView);
  const isDebug = __DEV__ && !!label;

  useEffect(() => {
    void service.connect();
    return () => service.disconnect();
  }, [service]);

  return (
    <View style={[styles.panel, compact && styles.panelCompact]}>
      {(label || matchStatus !== 'in_match') && (
        <View style={styles.header}>
          {label && <Text style={styles.label}>{label}</Text>}
          <Text style={[styles.connection, { color: isConnected ? '#2e9e5b' : '#c0392b' }]}>
            {isConnected ? `● Connected as ${username}` : '● Connecting to server…'}
          </Text>
        </View>
      )}

      {isDebug && matchStatus === 'in_match' && (
        <View style={styles.debugRow}>
          <DebugButton
            title={debugFlipView ? 'Toggle Player 2 View (on)' : 'Toggle Player 2 View'}
            active={debugFlipView}
            onPress={() => store.getState().toggleDebugFlipView()}
          />
          <DebugButton title="Force Win P1" onPress={() => service.debugForceWin()} />
        </View>
      )}

      {matchStatus === 'in_match' ? (
        <ArenaScreen store={store} service={service} compact={compact} />
      ) : matchStatus === 'ended' ? (
        <PostMatchScreen store={store} service={service} compact={compact} />
      ) : matchStatus === 'queued' ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.info}>
            {queueMode === 'tournament' ? 'Searching for a Weekly Tournament opponent…' : 'Searching for an opponent…'}
          </Text>
          <Pressable style={[styles.button, styles.secondary]} onPress={() => service.leaveQueue()}>
            <Text style={styles.buttonText}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.center}>
          <Pressable
            style={({ pressed }) => [styles.button, (!isConnected || pressed) && styles.dimmed]}
            disabled={!isConnected}
            onPress={() => service.joinQueue('standard')}
          >
            <Text style={styles.buttonText}>{isDebug ? 'Join Standard Ranked' : 'Find Match'}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.button, styles.tournament, (!isConnected || pressed) && styles.dimmed]}
            disabled={!isConnected}
            onPress={() => service.joinQueue('tournament')}
          >
            <Text style={[styles.buttonText, styles.tournamentText]}>
              {isDebug ? 'Join Weekly Tournament' : 'Weekly Tournament'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function DebugButton({ title, onPress, active = false }: { title: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.debugButton, active && styles.debugButtonActive, pressed && styles.dimmed]}
      onPress={onPress}
    >
      <Text style={styles.debugButtonText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, alignSelf: 'stretch', paddingVertical: 8, gap: 8 },
  panelCompact: { backgroundColor: '#1d2029', borderRadius: 16, padding: 8 },
  header: { alignItems: 'center', gap: 2 },
  label: { color: '#fff', fontSize: 16, fontWeight: '700' },
  connection: { fontSize: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  info: { color: '#c9ccd4', fontSize: 16, textAlign: 'center' },
  button: { backgroundColor: '#3b6cff', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14, minWidth: 240, alignItems: 'center' },
  secondary: { backgroundColor: '#3a3d46', minWidth: 0 },
  tournament: { backgroundColor: '#ffb020' },
  tournamentText: { color: '#1a1200' },
  dimmed: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  debugRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  debugButton: { backgroundColor: '#3a2140', borderColor: '#ff00aa', borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  debugButtonActive: { backgroundColor: '#ff00aa' },
  debugButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
