export type SoundName = "start" | "shot" | "hit" | "lock" | "scan" | "destroy" | "warning" | "boost" | "clear";

const SOUND: Record<SoundName, [number, number, number, OscillatorType]> = {
  start: [180, 620, 0.35, "sine"],
  shot: [780, 240, 0.07, "square"],
  hit: [95, 55, 0.2, "sawtooth"],
  lock: [420, 840, 0.12, "sine"],
  scan: [120, 980, 0.55, "sine"],
  destroy: [180, 42, 0.3, "sawtooth"],
  warning: [240, 190, 0.16, "square"],
  boost: [90, 130, 0.12, "sawtooth"],
  clear: [330, 880, 0.8, "triangle"]
};

export class AudioManager {
  private context?: AudioContext;
  private gain?: GainNode;
  private muted = false;
  private volume = 0.35;

  async resume(): Promise<void> {
    this.context ??= new AudioContext();
    if (!this.gain) {
      this.gain = this.context.createGain();
      this.gain.gain.value = this.muted ? 0 : this.volume;
      this.gain.connect(this.context.destination);
    }
    if (this.context.state === "suspended") await this.context.resume();
  }

  play(name: SoundName): void {
    if (!this.context || !this.gain || this.muted) return;
    const [from, to, duration, type] = SOUND[name];
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    const now = this.context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + duration);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(0.18, now + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope).connect(this.gain);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  setVolume(value: number): void {
    this.volume = value;
    if (this.gain) this.gain.gain.value = this.muted ? 0 : value;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.gain) this.gain.gain.value = this.muted ? 0 : this.volume;
    return this.muted;
  }
}
