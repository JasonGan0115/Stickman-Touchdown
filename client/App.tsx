import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { MatchPanel } from './src/components/MatchPanel';
import { ArenaScreen } from './src/screens/ArenaScreen';
import { DeckBuilderScreen } from './src/screens/DeckBuilderScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { PostMatchScreen } from './src/screens/PostMatchScreen';
import { TournamentScreen } from './src/screens/TournamentScreen';
import { SocketService, socketService } from './src/services/SocketService';
import { soundService } from './src/services/SoundService';
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
  const [clients] = useState(() => [createSimulatedClient('Client A'), createSimulatedClient('Client B')]);

  return (
    <View style={styles.debugList}>
      {clients.map((c) => (
        <MatchPanel key={c.label} label={c.label} service={c.service} store={c.store} compact />
      ))}
    </View>
  );
}

export type MainTab = 'home' | 'deck' | 'tournament';

function AppContent() {
  const insets = useSafeAreaInsets();
  const [debugMode, setDebugMode] = useState(false);
  const [activeTab, setActiveTab] = useState<MainTab>('home');

  const matchStatus = useGameStore((s) => s.matchStatus);
  const queueMode = useGameStore((s) => s.queueMode);

  useEffect(() => {
    if (!debugMode) {
      void socketService.connect();
    }
    return () => {
      socketService.disconnect();
    };
  }, [debugMode]);

  const inMatch = matchStatus === 'in_match';
  const isQueued = matchStatus === 'queued';
  const isEnded = matchStatus === 'ended';
  const hasTabBar = !debugMode && !inMatch && !isEnded && !isQueued;

  return (
    <View
      style={[
        styles.container,
        { paddingTop: Math.max(insets.top, inMatch ? 12 : 16) },
        inMatch && styles.containerInMatch,
        !hasTabBar && { paddingBottom: inMatch ? Math.max(insets.bottom, 16) : insets.bottom },
      ]}
    >
        {debugMode ? (
          <DebugView />
        ) : inMatch ? (
          <ArenaScreen store={useGameStore} service={socketService} />
        ) : isEnded ? (
          <PostMatchScreen store={useGameStore} service={socketService} />
        ) : isQueued ? (
          <View style={styles.queueContainer}>
            <ActivityIndicator size="large" color="#38bdf8" />
            <Text style={styles.queueTitle}>
              {queueMode === 'tournament'
                ? 'Searching for Weekly Tournament Opponent…'
                : 'Searching for Gridiron Opponent…'}
            </Text>
            <Text style={styles.queueSub}>First to 3 Touchdowns · Real-time Matchmaking</Text>
            <Pressable
              style={({ pressed }) => [styles.cancelQueueButton, pressed && styles.dimmed]}
              onPress={() => socketService.leaveQueue()}
            >
              <Text style={styles.cancelQueueText}>Cancel Matchmaking</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.contentWrap}>
            {/* Top Bar with optional Dual Debug Mode Switch */}
            {__DEV__ && (
              <View style={styles.devBar}>
                <Text style={styles.devLabel}>Dual Debug Mode</Text>
                <Switch value={debugMode} onValueChange={setDebugMode} />
              </View>
            )}

            {/* Main Tab Screen Content */}
            <View style={styles.tabContent}>
              {activeTab === 'home' ? (
                <HomeScreen store={useGameStore} service={socketService} onSelectTab={setActiveTab} />
              ) : activeTab === 'deck' ? (
                <DeckBuilderScreen onClose={() => setActiveTab('home')} />
              ) : (
                <TournamentScreen store={useGameStore} service={socketService} />
              )}
            </View>

            {/* Bottom 3-Tab Navigation Bar */}
            <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
              <Pressable
                style={[styles.tabItem, activeTab === 'home' && styles.tabItemActive]}
                onPress={() => {
                  soundService.playSpawn();
                  setActiveTab('home');
                }}
              >
                <Text style={styles.tabIcon}>🏈</Text>
                <Text style={[styles.tabLabel, activeTab === 'home' && styles.tabLabelActive]}>
                  Home
                </Text>
              </Pressable>

              <Pressable
                style={[styles.tabItem, activeTab === 'deck' && styles.tabItemActive]}
                onPress={() => {
                  soundService.playSpawn();
                  setActiveTab('deck');
                }}
              >
                <Text style={styles.tabIcon}>🃏</Text>
                <Text style={[styles.tabLabel, activeTab === 'deck' && styles.tabLabelActive]}>
                  Deck
                </Text>
              </Pressable>

              <Pressable
                style={[styles.tabItem, activeTab === 'tournament' && styles.tabItemActive]}
                onPress={() => {
                  soundService.playSpawn();
                  setActiveTab('tournament');
                }}
              >
                <Text style={styles.tabIcon}>⏳</Text>
                <Text style={[styles.tabLabel, activeTab === 'tournament' && styles.tabLabelActive]}>
                  Coming Soon
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        <StatusBar style="light" />
      </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AppContent />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: '#14161c',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  containerInMatch: {
    paddingHorizontal: 8,
  },
  contentWrap: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  devBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: '100%',
    paddingHorizontal: 16,
    paddingBottom: 6,
    gap: 8,
  },
  devLabel: {
    color: '#8a8f9c',
    fontSize: 12,
    fontWeight: '700',
  },
  tabContent: {
    flex: 1,
    alignSelf: 'stretch',
  },
  tabBar: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    backgroundColor: '#181b24',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 8,
    paddingHorizontal: 16,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 12,
    gap: 2,
  },
  tabItemActive: {
    backgroundColor: 'rgba(6, 214, 160, 0.12)',
  },
  tabIcon: {
    fontSize: 20,
  },
  tabLabel: {
    color: '#8a8f9c',
    fontSize: 11,
    fontWeight: '700',
  },
  tabLabelActive: {
    color: '#06d6a0',
    fontWeight: '800',
  },

  queueContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  queueTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  queueSub: {
    color: '#8a8f9c',
    fontSize: 13,
    textAlign: 'center',
  },
  cancelQueueButton: {
    backgroundColor: '#3a3d46',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginTop: 8,
  },
  cancelQueueText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  debugList: {
    flex: 1,
    alignSelf: 'stretch',
    gap: 12,
    marginTop: 12,
    paddingHorizontal: 12,
  },
  dimmed: {
    opacity: 0.5,
  },
});
