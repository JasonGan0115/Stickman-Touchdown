import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { MatchPanel } from './src/components/MatchPanel';
import { DeckBuilderScreen } from './src/screens/DeckBuilderScreen';
import { SocketService, socketService } from './src/services/SocketService';
import { createGameStore, useGameStore, type GameStore } from './src/store/useGameStore';

interface SimulatedClient {
  label: string;
  store: GameStore;
  service: SocketService;
}

function createSimulatedClient(label: string): SimulatedClient {
  const store = createGameStore();
  return { label, store, service: new SocketService(store, label) };
}

/** Two fully independent clients (own socket + own store) so matchmaking can be tested on one device. */
function DebugView() {
  // Created once per time Debug Mode is switched on; each MatchPanel connects
  // on mount and disconnects when Debug Mode is switched off.
  const [clients] = useState(() => [createSimulatedClient('Client A'), createSimulatedClient('Client B')]);

  return (
    <View style={styles.debugList}>
      {clients.map((c) => (
        <MatchPanel key={c.label} label={c.label} service={c.service} store={c.store} compact />
      ))}
    </View>
  );
}

type Screen = 'play' | 'deck';

export default function App() {
  const [debugMode, setDebugMode] = useState(false);
  const [screen, setScreen] = useState<Screen>('play');
  const mainStatus = useGameStore((s) => s.matchStatus);
  // Give the arena the whole screen during a normal match
  const inMainMatch = mainStatus === 'in_match' && !debugMode;
  const inLobby = !debugMode && mainStatus === 'idle';

  return (
    // Required at the root for react-native-gesture-handler (used by the Deck Builder)
    <GestureHandlerRootView style={styles.root}>
      <View style={[styles.container, inMainMatch && styles.containerInMatch]}>
        {screen === 'deck' ? (
          <DeckBuilderScreen onClose={() => setScreen('play')} />
        ) : (
          <>
            {!inMainMatch && <Text style={styles.title}>Touchdown PVP</Text>}

            {!inMainMatch && (
              <View style={styles.toolbar}>
                {inLobby && (
                  <Pressable
                    style={({ pressed }) => [styles.deckButton, pressed && styles.dimmed]}
                    onPress={() => setScreen('deck')}
                  >
                    <Text style={styles.deckButtonText}>Deck Builder</Text>
                  </Pressable>
                )}
                {/* __DEV__ is false in release builds, so the toggle never ships to players */}
                {__DEV__ && (
                  <View style={styles.debugToggle}>
                    <Text style={styles.debugLabel}>Debug Mode</Text>
                    <Switch value={debugMode} onValueChange={setDebugMode} />
                  </View>
                )}
              </View>
            )}

            {/* Only one of these is mounted at a time, so the main connection is closed
                while debugging and can't get paired with Client A or B by accident. */}
            {debugMode ? <DebugView /> : <MatchPanel service={socketService} store={useGameStore} />}
          </>
        )}

        <StatusBar style="light" />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, backgroundColor: '#14161c', alignItems: 'center', paddingTop: 64, paddingHorizontal: 16, paddingBottom: 24 },
  containerInMatch: { paddingTop: 48, paddingHorizontal: 8, paddingBottom: 16 },
  title: { color: '#fff', fontSize: 32, fontWeight: '800' },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
  deckButton: { backgroundColor: '#262a35', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  deckButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  dimmed: { opacity: 0.6 },
  debugToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  debugLabel: { color: '#c9ccd4', fontSize: 14 },
  debugList: { flex: 1, alignSelf: 'stretch', gap: 12, marginTop: 12 },
});
