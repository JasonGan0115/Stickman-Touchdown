import { Vibration } from 'react-native';

/**
 * Sound & Haptic Service
 * Dispatches tactile haptic vibrations and sound event hooks across gameplay.
 */
class SoundService {
  private soundEnabled = true;
  private hapticsEnabled = true;

  setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  setHapticsEnabled(enabled: boolean) {
    this.hapticsEnabled = enabled;
  }

  /** Triggered when a troop card is selected or deployed */
  playSpawn() {
    if (this.hapticsEnabled) {
      try {
        Vibration.vibrate(25);
      } catch {
        // unsupported platform/environment safe
      }
    }
  }

  /** Triggered on combat engagement / weapon swing hit */
  playCombatHit() {
    if (this.hapticsEnabled) {
      try {
        Vibration.vibrate(15);
      } catch {
        // ignore
      }
    }
  }

  /** Explosive touchdown celebration burst */
  playTouchdown() {
    if (this.hapticsEnabled) {
      try {
        // Double burst vibration on touchdown
        Vibration.vibrate([0, 100, 50, 200]);
      } catch {
        // ignore
      }
    }
  }

  /** Whistle blow at match start or kickoff */
  playWhistle() {
    if (this.hapticsEnabled) {
      try {
        Vibration.vibrate(60);
      } catch {
        // ignore
      }
    }
  }

  /** Triggered on cooldown error or rejection */
  playWarning() {
    if (this.hapticsEnabled) {
      try {
        Vibration.vibrate([0, 40, 40, 40]);
      } catch {
        // ignore
      }
    }
  }

  /** Triggered on selecting an augment card in the draft */
  playDraftPick() {
    if (this.hapticsEnabled) {
      try {
        Vibration.vibrate(35);
      } catch {
        // ignore
      }
    }
  }
}

export const soundService = new SoundService();
