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
    if (this.soundEnabled) {
      this.playWebTouchdownFanfare();
    }
  }

  /** Synthesized stadium horn + rising chord on web browsers */
  private playWebTouchdownFanfare() {
    try {
      const w = globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const Ctx = w.AudioContext ?? w.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const now = ctx.currentTime;
      const notes = [261.63, 329.63, 392.0, 523.25]; // C4-E4-G4-C5 fanfare chord
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.045);
        gain.gain.setValueAtTime(0.001, now + i * 0.045);
        gain.gain.exponentialRampToValueAtTime(0.08, now + i * 0.045 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.045);
        osc.stop(now + 0.7);
      });
      setTimeout(() => {
        ctx.close().catch(() => {});
      }, 900);
    } catch {
      // ignore if audio context is blocked or unavailable
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
