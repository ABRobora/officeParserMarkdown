/**
 * Procedural audio — every sound is synthesized in WebAudio at runtime,
 * keeping the repo asset-free (same philosophy as src/art.ts). Final
 * recorded audio replaces these one call-site at a time.
 *
 * Call sfx.unlock() from a user-gesture handler before anything will play.
 */
class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private waterNodes: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private trickleNodes: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private motifTimer: number | null = null;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem('bd-muted') === '1';
    } catch {
      /* storage unavailable — default unmuted */
    }
  }

  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.75;
      this.master.connect(this.ctx.destination);
      this.noise = this.makeNoiseBuffer();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem('bd-muted', muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.75, this.ctx.currentTime, 0.05);
    }
  }

  private makeNoiseBuffer(): AudioBuffer {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Short filtered-noise burst — the workhorse for crunches and splashes. */
  private burst(opts: {
    dur: number;
    type: BiquadFilterType;
    freq: number;
    freqEnd?: number;
    q?: number;
    gain: number;
    attack?: number;
  }): void {
    if (!this.ctx || !this.noise || !this.master) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = opts.type;
    filter.frequency.setValueAtTime(opts.freq, t);
    if (opts.freqEnd) filter.frequency.exponentialRampToValueAtTime(opts.freqEnd, t + opts.dur);
    filter.Q.value = opts.q ?? 1;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(opts.gain, t + (opts.attack ?? 0.01));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + opts.dur + 0.05);
  }

  /** Soft melodic tone with a felt-piano envelope. */
  private tone(freq: number, dur: number, gainVal: number, delay = 0, type: OscillatorType = 'triangle'): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(gainVal, t + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  // ---- ambiences ----

  /** Continuous river ambience for the valley. */
  startWater(): void {
    if (!this.ctx || !this.noise || !this.master || this.waterNodes) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    const gain = this.ctx.createGain();
    gain.gain.value = 0.045;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    this.waterNodes = { src, gain };
  }

  stopWater(): void {
    this.waterNodes?.src.stop();
    this.waterNodes = null;
  }

  /**
   * The leak. A thin, high trickle whose loudness the game scene sets from
   * Dan's distance — the player literally finds the leak by ear.
   */
  startTrickle(): void {
    if (!this.ctx || !this.noise || !this.master || this.trickleNodes) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3400;
    filter.Q.value = 2.5;
    const wobble = this.ctx.createOscillator();
    wobble.frequency.value = 6;
    const wobbleGain = this.ctx.createGain();
    wobbleGain.gain.value = 600;
    wobble.connect(wobbleGain).connect(filter.frequency);
    wobble.start();
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    this.trickleNodes = { src, gain };
  }

  setTrickleVolume(v: number): void {
    if (this.ctx && this.trickleNodes) {
      this.trickleNodes.gain.gain.setTargetAtTime(Math.max(0, Math.min(0.35, v)), this.ctx.currentTime, 0.1);
    }
  }

  stopTrickle(): void {
    this.trickleNodes?.src.stop();
    this.trickleNodes = null;
  }

  // ---- one-shots ----

  /** Gnaw crunch; pitch climbs with progress so the fell feels earned. */
  gnaw(progress: number): void {
    this.burst({ dur: 0.07, type: 'bandpass', freq: 700 + progress * 900, q: 3, gain: 0.22 });
  }

  treeFall(): void {
    this.burst({ dur: 0.5, type: 'lowpass', freq: 320, freqEnd: 90, gain: 0.5, attack: 0.04 });
    this.tone(58, 0.45, 0.5, 0.05, 'sine');
  }

  splash(big = false): void {
    this.burst({ dur: big ? 0.45 : 0.25, type: 'bandpass', freq: 1400, freqEnd: 320, q: 0.8, gain: big ? 0.4 : 0.22 });
  }

  /** The gunshot-crack of a tail-slap, then the wash. */
  tailSlap(): void {
    this.burst({ dur: 0.07, type: 'highpass', freq: 900, gain: 0.85, attack: 0.003 });
    this.burst({ dur: 0.5, type: 'bandpass', freq: 900, freqEnd: 250, gain: 0.35, attack: 0.03 });
  }

  dive(): void {
    this.burst({ dur: 0.35, type: 'lowpass', freq: 900, freqEnd: 200, gain: 0.3 });
  }

  bubble(): void {
    this.tone(300 + Math.random() * 500, 0.09, 0.06, 0, 'sine');
  }

  eat(): void {
    this.burst({ dur: 0.06, type: 'bandpass', freq: 1100, q: 4, gain: 0.18 });
    setTimeout(() => this.burst({ dur: 0.06, type: 'bandpass', freq: 950, q: 4, gain: 0.15 }), 140);
  }

  /** Mud squelch for patching the dam / digging canals. */
  mud(): void {
    this.burst({ dur: 0.22, type: 'lowpass', freq: 500, freqEnd: 150, gain: 0.3 });
    this.tone(110, 0.18, 0.12, 0.02, 'sine');
  }

  growl(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(82, t);
    osc.frequency.linearRampToValueAtTime(64, t + 0.6);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 240;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.16, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    osc.connect(filter).connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.75);
  }

  /** Two-note chime for a Field Note arriving. */
  chime(): void {
    this.tone(659.3, 0.5, 0.12); // E5
    this.tone(987.8, 0.7, 0.1, 0.12); // B5
  }

  /** Rising wash for the flood cinematic. */
  floodSwell(): void {
    this.burst({ dur: 3.2, type: 'lowpass', freq: 200, freqEnd: 900, gain: 0.28, attack: 0.8 });
    const phrase = [261.6, 329.6, 392.0, 523.3]; // C-E-G-C
    phrase.forEach((f, i) => this.tone(f, 1.4, 0.09, 0.5 + i * 0.55));
  }

  // ---- music ----

  /** Sparse pentatonic piano phrase; loops gently on the title screen. */
  startMotif(): void {
    if (this.motifTimer !== null) return;
    const phrase: Array<[number, number]> = [
      [392.0, 0.0], [440.0, 0.7], [523.3, 1.4], [587.3, 2.4], [523.3, 3.4], [440.0, 4.6], [392.0, 5.4]
    ];
    const play = () => {
      for (const [f, d] of phrase) {
        this.tone(f, 1.6, 0.07, d);
        this.tone(f / 2, 2.0, 0.04, d); // soft octave-below shadow
      }
    };
    play();
    this.motifTimer = window.setInterval(play, 9000);
  }

  stopMotif(): void {
    if (this.motifTimer !== null) {
      clearInterval(this.motifTimer);
      this.motifTimer = null;
    }
  }

  /** A few held notes at dawn/dusk — punctuation, not soundtrack. */
  motifSting(dusk: boolean): void {
    const notes = dusk ? [329.6, 293.7, 261.6] : [261.6, 329.6, 392.0];
    notes.forEach((f, i) => this.tone(f, 1.8, 0.06, i * 0.7));
  }
}

export const sfx = new Sfx();
