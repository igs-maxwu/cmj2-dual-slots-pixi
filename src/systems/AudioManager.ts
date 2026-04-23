import { SFX_KEYS, type BgmKey, type SfxKey } from '@/config/AudioAssets';

const BGM_VOLUME = 0.6;
const CROSSFADE_MS = 150;
const CROSSFADE_INTERVAL_MS = 20;
const CROSSFADE_STEPS = Math.ceil(CROSSFADE_MS / CROSSFADE_INTERVAL_MS);

function base(): string {
  return (import.meta as { env: { BASE_URL: string } }).env.BASE_URL;
}

export class AudioManager {
  private static sfxMap = new Map<SfxKey, HTMLAudioElement>();
  private static currentBgm: HTMLAudioElement | null = null;
  private static masterVolume = 1.0;
  private static muted = false;

  static init(): Promise<void> {
    const b = base();
    for (const key of SFX_KEYS) {
      const el = new Audio(`${b}assets/audio/sfx/${key}.mp3`);
      el.preload = 'auto';
      AudioManager.sfxMap.set(key, el);
    }
    return Promise.resolve();
  }

  static playBgm(key: BgmKey, loop = true): void {
    const b = base();
    const incoming = new Audio(`${b}assets/audio/bgm/${key}.mp3`);
    incoming.loop = loop;
    incoming.volume = 0;

    const outgoing = AudioManager.currentBgm;
    AudioManager.currentBgm = incoming;

    // Fade in new track
    let inStep = 0;
    const targetVol = AudioManager.muted ? 0 : BGM_VOLUME * AudioManager.masterVolume;
    const inTimer = setInterval(() => {
      inStep++;
      incoming.volume = Math.min(targetVol, (inStep / CROSSFADE_STEPS) * targetVol);
      if (inStep >= CROSSFADE_STEPS) clearInterval(inTimer);
    }, CROSSFADE_INTERVAL_MS);

    incoming.play().catch(() => { /* autoplay blocked — will play on next gesture */ });

    // Fade out old track
    if (outgoing) {
      let outStep = 0;
      const startVol = outgoing.volume;
      const outTimer = setInterval(() => {
        outStep++;
        outgoing.volume = Math.max(0, startVol * (1 - outStep / CROSSFADE_STEPS));
        if (outStep >= CROSSFADE_STEPS) {
          clearInterval(outTimer);
          outgoing.pause();
        }
      }, CROSSFADE_INTERVAL_MS);
    }
  }

  static stopBgm(): void {
    if (!AudioManager.currentBgm) return;
    const bgm = AudioManager.currentBgm;
    AudioManager.currentBgm = null;
    let step = 0;
    const startVol = bgm.volume;
    const timer = setInterval(() => {
      step++;
      bgm.volume = Math.max(0, startVol * (1 - step / CROSSFADE_STEPS));
      if (step >= CROSSFADE_STEPS) {
        clearInterval(timer);
        bgm.pause();
      }
    }, CROSSFADE_INTERVAL_MS);
  }

  static playSfx(key: SfxKey, volume = 1.0): void {
    const src = AudioManager.sfxMap.get(key);
    if (!src) return;
    const clone = src.cloneNode(true) as HTMLAudioElement;
    clone.volume = AudioManager.muted ? 0 : Math.min(1, volume * AudioManager.masterVolume);
    clone.play().catch(() => { /* autoplay blocked */ });
  }

  static setMasterVolume(v: number): void {
    AudioManager.masterVolume = Math.max(0, Math.min(1, v));
    if (AudioManager.currentBgm) {
      AudioManager.currentBgm.volume = AudioManager.muted
        ? 0
        : BGM_VOLUME * AudioManager.masterVolume;
    }
  }

  static mute(on: boolean): void {
    AudioManager.muted = on;
    if (AudioManager.currentBgm) {
      AudioManager.currentBgm.volume = on ? 0 : BGM_VOLUME * AudioManager.masterVolume;
    }
  }
}
