const MUTE_STORAGE_KEY = "vb_starforge_muted";

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted: boolean = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_STORAGE_KEY) === "1";
    } catch {
      this.muted = false;
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(nextMuted: boolean): void {
    this.muted = nextMuted;
    try {
      localStorage.setItem(MUTE_STORAGE_KEY, nextMuted ? "1" : "0");
    } catch {
      // Ignore storage errors
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        nextMuted ? 0 : 0.32,
        this.ctx.currentTime,
        0.02,
      );
    }
  }

  public unlock(): void {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.32;
      this.masterGain.connect(this.ctx.destination);
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 0.6;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private ready(): boolean {
    if (this.muted || !this.ctx || !this.masterGain) return false;
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return true;
  }

  public playShoot(barrelCount: number = 1): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    const baseFreq = 620 + Math.random() * 80 - (barrelCount - 1) * 40;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.085);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  public playDash(): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1600, now);
      filter.frequency.exponentialRampToValueAtTime(340, now + 0.16);
      filter.Q.value = 1.8;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      src.start(now);
      src.stop(now + 0.18);
    }

    const osc = this.ctx.createOscillator();
    const oGain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.14);
    oGain.gain.setValueAtTime(0.18, now);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(oGain);
    oGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playHit(heavy: boolean = false): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = heavy ? "sawtooth" : "square";
    osc.frequency.setValueAtTime(heavy ? 240 : 420 + Math.random() * 60, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + (heavy ? 0.09 : 0.05));

    gain.gain.setValueAtTime(heavy ? 0.14 : 0.07, now);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      now + (heavy ? 0.095 : 0.055),
    );

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playShieldDeflect(): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1180 + Math.random() * 140, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.065);

    gain.gain.setValueAtTime(0.085, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  public playRepairBeam(): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(540, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.14);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.048, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playExplosion(scale: "small" | "medium" | "boss" = "small"): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const dur = scale === "boss" ? 0.55 : scale === "medium" ? 0.28 : 0.17;
    const vol = scale === "boss" ? 0.42 : scale === "medium" ? 0.28 : 0.18;

    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(scale === "boss" ? 950 : 1200, now);
      filter.frequency.exponentialRampToValueAtTime(110, now + dur);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      src.start(now);
      src.stop(now + dur + 0.02);
    }

    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = "sine";
    sub.frequency.setValueAtTime(scale === "boss" ? 140 : 180, now);
    sub.frequency.exponentialRampToValueAtTime(34, now + dur);
    subGain.gain.setValueAtTime(vol * 0.9, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + dur + 0.02);
  }

  public playPickup(combo: number = 1): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    const pitchBoost = Math.min(combo, 8) * 45;
    osc.frequency.setValueAtTime(660 + pitchBoost, now);
    osc.frequency.exponentialRampToValueAtTime(1120 + pitchBoost, now + 0.09);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playTelegraph(): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.linearRampToValueAtTime(880, now + 0.16);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playPulse(): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.36);

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2200, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + 0.36);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  public playPlayerDamage(shieldAbsorbed: boolean): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = shieldAbsorbed ? "triangle" : "sawtooth";
    osc.frequency.setValueAtTime(shieldAbsorbed ? 380 : 190, now);
    osc.frequency.exponentialRampToValueAtTime(
      shieldAbsorbed ? 140 : 52,
      now + 0.22,
    );

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playTimeDilation(): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.42);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.46);

    const shimmer = this.ctx.createOscillator();
    const sGain = this.ctx.createGain();
    shimmer.type = "triangle";
    shimmer.frequency.setValueAtTime(980, now);
    shimmer.frequency.exponentialRampToValueAtTime(320, now + 0.3);
    sGain.gain.setValueAtTime(0.09, now);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    shimmer.connect(sGain);
    sGain.connect(this.masterGain);
    shimmer.start(now);
    shimmer.stop(now + 0.34);
  }

  public playShieldRecharge(): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.22);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.26);

    const harmonic = this.ctx.createOscillator();
    const hGain = this.ctx.createGain();
    harmonic.type = "triangle";
    harmonic.frequency.setValueAtTime(780, now + 0.04);
    harmonic.frequency.exponentialRampToValueAtTime(1180, now + 0.22);
    hGain.gain.setValueAtTime(0.001, now + 0.04);
    hGain.gain.linearRampToValueAtTime(0.08, now + 0.06);
    hGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    harmonic.connect(hGain);
    hGain.connect(this.masterGain);
    harmonic.start(now + 0.04);
    harmonic.stop(now + 0.25);
  }

  public playWaveClear(): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.065;
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.15, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.27);
    });
  }

  public playAchievement(): void {
    if (!this.ready() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const notes = [659.25, 880, 1318.51];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.055;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  }
}

export const soundEngine = new SoundEngine();
