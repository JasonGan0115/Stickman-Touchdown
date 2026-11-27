import { memo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from 'zustand';

import type { SocketService } from '../services/SocketService';
import { soundService } from '../services/SoundService';
import type { AugmentDraftOption, GameStore, HandCard } from '../store/useGameStore';
import { Stickman } from './Stickman';

const RARITY_COLORS: Record<AugmentDraftOption['rarity'], string> = {
  Common: '#c0c8d8', // Silver
  Rare: '#ffc107', // Gold
  Epic: '#a855f7', // Purple
  Legendary: '#ff6b35', // Legendary Orange-Gold
};

interface Props {
  store: GameStore;
  service: SocketService;
}

export const DraftModal = memo(function DraftModal({ store, service }: Props) {
  const draftModal = useStore(store, (s) => s.draftModal);
  const opponentPreview = useStore(store, (s) => s.opponentPreview);
  const kickoffRemainingMs = useStore(store, (s) => s.kickoffRemainingMs);
  const pickedRef = useRef(false);

  if (!draftModal || !draftModal.active) {
    pickedRef.current = false;
    return null;
  }

  const isKickoff = draftModal.type === 'silver_kickoff';
  const isComeback = draftModal.type === 'comeback';
  const kickoffSec = Math.max(1, Math.ceil(kickoffRemainingMs / 1000));

  const onSelect = (aug: AugmentDraftOption) => {
    if (pickedRef.current) return;
    pickedRef.current = true;
    soundService.playDraftPick();
    service.pickDraft(aug.id, isComeback);
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        {/* Opponent Scouting Section (Pre-Match) */}
        {isKickoff && opponentPreview.length > 0 && (
          <View style={styles.scoutingSection}>
            <Text style={styles.sectionHeader}>🔍 OPPONENT SCOUTING REPORT</Text>
            <Text style={styles.sectionSub}>{"4 random troops revealed from opponent's 8-troop deck:"}</Text>
            <View style={styles.previewGrid}>
              {opponentPreview.map((card: HandCard, i: number) => (
                <View key={`${card.cardId}-${i}`} style={styles.previewCard}>
                  <View style={styles.previewCost}>
                    <Text style={styles.previewCostText}>{card.cost}</Text>
                  </View>
                  {card.type === 'Spell' || card.type === 'Tower' ? (
                    <Text style={{ fontSize: 20, lineHeight: 26 }}>
                      {card.type === 'Spell'
                        ? card.cardId === 'card_zap_shock'
                          ? '⚡'
                          : card.cardId === 'card_glue_freeze'
                            ? '❄️'
                            : '💣'
                        : card.cardId === 'card_magnet_tower'
                          ? '🧲'
                          : '🗼'}
                    </Text>
                  ) : (
                    <Stickman type={card.type} movement={card.movement} teamColor="#e0262b" size={26} animated={false} />
                  )}
                  <Text style={styles.previewCardName} numberOfLines={1}>
                    {card.name}
                  </Text>
                  <Text style={styles.previewCardType}>{card.movement ?? card.type}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Draft Choices Section */}
        <View style={styles.draftSection}>
          {isKickoff && kickoffRemainingMs > 0 && (
            <View style={styles.countdownPill}>
              <Text style={styles.countdownText}>⏱ KICKOFF IN {kickoffSec}s</Text>
            </View>
          )}
          <Text style={[styles.draftTitle, isComeback && styles.comebackTitle]}>
            {isKickoff
              ? '⚡ CHOOSE KICKOFF AUGMENT'
              : draftModal.role === 'winner'
                ? draftModal.tierLabel === 'LEGENDARY'
                  ? '🏆 ROUND WON · LEGENDARY AUGMENT'
                  : '🏆 ROUND WON · GOLD AUGMENT'
                : draftModal.tierLabel === 'LEGENDARY'
                  ? '🔥 FINAL COMEBACK · LEGENDARY'
                  : '⚡ COMEBACK · EPIC AUGMENT'}
          </Text>
          <Text style={styles.draftSub}>
            {isKickoff
              ? 'Select 1 Silver augment before troop deployment begins:'
              : draftModal.role === 'winner'
                ? 'You scored! Pick 1 augment to press your advantage:'
                : 'Opponent scored! Pick 1 comeback augment to turn the tide:'}
          </Text>

          <View style={styles.optionsRow}>
            {draftModal.options.map((aug) => {
              const border = RARITY_COLORS[aug.rarity] || '#fff';
              return (
                <Pressable
                  key={aug.id}
                  style={({ pressed }) => [styles.augCard, { borderColor: border }, pressed && styles.pressed]}
                  onPressIn={() => onSelect(aug)}
                >
                  <View style={[styles.rarityBadge, { backgroundColor: border }]}>
                    <Text style={styles.rarityBadgeText}>
                      {aug.rarity === 'Common' ? 'SILVER' : aug.rarity === 'Rare' ? 'GOLD' : aug.rarity.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.augName} numberOfLines={1}>
                    {aug.name}
                  </Text>
                  <Text style={styles.augEffect}>{aug.effect}</Text>
                  <Text style={styles.tapToPick}>TAP TO PICK</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10,12,18,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 999,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1a1d26',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  scoutingSection: {
    backgroundColor: '#12141a',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionHeader: {
    color: '#ff9a9a',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sectionSub: {
    color: '#8a8f9c',
    fontSize: 11,
    marginTop: 2,
    marginBottom: 8,
  },
  previewGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  previewCard: {
    flex: 1,
    backgroundColor: '#202430',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  previewCost: {
    position: 'absolute',
    top: 3,
    left: 3,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#06d6a0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCostText: {
    color: '#10141c',
    fontSize: 9,
    fontWeight: '900',
  },
  previewCardName: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  previewCardType: {
    color: '#8a8f9c',
    fontSize: 9,
    textTransform: 'capitalize',
  },

  draftSection: {
    gap: 8,
  },
  countdownPill: {
    alignSelf: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  countdownText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  draftTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  comebackTitle: {
    color: '#ffb020',
  },
  draftSub: {
    color: '#a9aebb',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  augCard: {
    flex: 1,
    minHeight: 110,
    backgroundColor: '#262a35',
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  pressed: {
    transform: [{ scale: 0.96 }],
    backgroundColor: '#323746',
  },
  rarityBadge: {
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginBottom: 4,
  },
  rarityBadgeText: {
    color: '#10141c',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  augName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  augEffect: {
    color: '#06d6a0',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    marginVertical: 4,
  },
  tapToPick: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
