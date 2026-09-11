type OscillatorWave = OscillatorType;

export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicOscillators: OscillatorNode[] = [];

  async resume(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.context.destination);
      this.musicGain = this.context.createGain();
      this.musicGain.gain.value = 0.035;
      this.musicGain.connect(this.master);
    }

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  startMusic(intensity: 'menu' | 'battle' | 'boss' = 'menu'): void {
    if (!this.context || !this.musicGain || this.musicOscillators.length > 0) return;
    const notes = intensity === 'boss' ? [55, 82.41, 110] : intensity === 'battle' ? [65.41, 98, 130.81] : [49, 73.42, 98];
    for (const [index, frequency] of notes.entries()) {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = index === 0 ? 'sine' : 'triangle';
      osc.frequency.value = frequency;
      gain.gain.value = index === 0 ? 0.7 : 0.22;
      osc.connect(gain).connect(this.musicGain);
      osc.start();
      this.musicOscillators.push(osc);
    }
  }

  stopMusic(): void {
    for (const osc of this.musicOscillators) {
      try {
        osc.stop();
      } catch {
        // Already stopped.
      }
    }
    this.musicOscillators = [];
  }

  click(): void {
    this.tone(520, 0.05, 'triangle', 0.08);
  }

  slash(): void {
    this.sweep(360, 90, 0.11, 'sawtooth', 0.13);
  }

  hit(): void {
    this.noise(0.08, 0.13);
    this.tone(130, 0.08, 'square', 0.05);
  }

  dodge(): void {
    this.sweep(220, 840, 0.16, 'triangle', 0.08);
  }

  magic(): void {
    this.sweep(180, 620, 0.28, 'sine', 0.12);
  }

  ultimate(): void {
    this.sweep(45, 320, 0.9, 'sawtooth', 0.19);
    window.setTimeout(() => this.noise(0.35, 0.18), 540);
  }

  bossPhase(): void {
    this.sweep(90, 55, 0.42, 'square', 0.12);
  }

  private tone(frequency: number, duration: number, type: OscillatorWave, volume: number): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private sweep(start: number, end: number, duration: number, type: OscillatorWave, volume: number): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(start, now);
    osc.frequency.exponentialRampToValueAtTime(end, now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.04);
  }

  private noise(duration: number, volume: number): void {
    if (!this.context || !this.master) return;
    const bufferSize = Math.floor(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      output[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(gain).connect(this.master);
    source.start();
  }
}
