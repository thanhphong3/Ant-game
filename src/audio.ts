// Every sound is synthesized with Web Audio, so the game ships with no audio files.
type Mode = 'menu' | 'run' | 'boss' | 'off';

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

// 16-step patterns, MIDI notes (0 = rest).
const SONGS: Record<Exclude<Mode, 'off'>, { bpm: number; bass: number[]; lead: number[]; drums: string }> = {
  menu: {
    bpm: 104,
    bass: [48, 0, 55, 0, 52, 0, 55, 0, 45, 0, 52, 0, 50, 0, 55, 0],
    lead: [72, 0, 76, 79, 0, 76, 74, 0, 72, 0, 69, 0, 74, 72, 0, 0],
    drums: 'k.h.s.h.k.hks.h.',
  },
  run: {
    bpm: 132,
    bass: [48, 48, 0, 55, 53, 0, 55, 0, 45, 45, 0, 52, 50, 0, 55, 53],
    lead: [79, 0, 76, 0, 79, 81, 79, 76, 74, 0, 72, 74, 76, 0, 72, 0],
    drums: 'k.hsk.hsk.hskhsh',
  },
  boss: {
    bpm: 150,
    bass: [43, 43, 46, 43, 48, 43, 46, 41, 43, 43, 46, 43, 50, 48, 46, 41],
    lead: [67, 70, 0, 67, 72, 0, 70, 67, 74, 0, 72, 70, 67, 0, 63, 0],
    drums: 'khskkhskkhskksss',
  },
};

export class Sound {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  sfxOn = true;
  musicOn = true;
  private mode: Mode = 'off';
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  party = false; // DJ captain speeds the music up

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.32;
      this.musicBus.connect(this.master);
      const len = this.ctx.sampleRate * 0.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applySettings();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  applySettings() {
    if (!this.ctx) return;
    this.sfxBus.gain.value = this.sfxOn ? 1 : 0;
    this.musicBus.gain.value = this.musicOn ? 0.32 : 0;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0, bus?: GainNode) {
    const c = this.ctx;
    if (!c) return;
    const t0 = Math.max(c.currentTime, 0) + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(bus ?? this.sfxBus);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, vol: number, freq: number, type: BiquadFilterType = 'bandpass', at?: number, bus?: GainNode) {
    const c = this.ctx;
    if (!c) return;
    const t0 = at ?? c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(bus ?? this.sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  private lastPick = 0;
  pick(combo = 0) {
    if (!this.ctx || this.ctx.currentTime - this.lastPick < 0.035) return;
    this.lastPick = this.ctx.currentTime;
    const base = 620 + Math.min(combo, 20) * 28;
    this.tone(base, 0.07, 'square', 0.05, base * 1.5);
  }
  spawn() {
    this.tone(900 + Math.random() * 300, 0.05, 'triangle', 0.04, 1400);
  }
  gateGood() {
    [0, 4, 7, 12].forEach((n, i) => this.tone(NOTE(72 + n), 0.12, 'square', 0.07, undefined, i * 0.06));
  }
  gateBad() {
    [7, 3, 0].forEach((n, i) => this.tone(NOTE(60 + n), 0.16, 'sawtooth', 0.05, undefined, i * 0.08));
  }
  private lastPoof = 0;
  poof() {
    if (!this.ctx || this.ctx.currentTime - this.lastPoof < 0.05) return;
    this.lastPoof = this.ctx.currentTime;
    this.noise(0.12, 0.15, 1800 + Math.random() * 1200);
  }
  hit() {
    this.noise(0.05, 0.12, 3000, 'highpass');
    this.tone(220 + Math.random() * 80, 0.05, 'square', 0.03, 110);
  }
  stomp() {
    this.tone(90, 0.35, 'sine', 0.5, 35);
    this.noise(0.3, 0.3, 300, 'lowpass');
  }
  warn() {
    this.tone(880, 0.1, 'square', 0.05);
    this.tone(660, 0.1, 'square', 0.05, undefined, 0.12);
  }
  carry() {
    [0, 5, 9, 12, 16].forEach((n, i) => this.tone(NOTE(67 + n), 0.1, 'triangle', 0.08, undefined, i * 0.05));
  }
  nope() {
    this.tone(300, 0.12, 'square', 0.05, 200);
  }
  click() {
    this.tone(1100, 0.04, 'square', 0.04, 700);
  }
  roar() {
    this.tone(120, 0.6, 'sawtooth', 0.12, 60);
    this.noise(0.6, 0.12, 500, 'lowpass');
  }
  win() {
    [0, 4, 7, 12, 7, 12, 16, 19].forEach((n, i) => this.tone(NOTE(67 + n), 0.18, 'square', 0.07, undefined, i * 0.09));
  }
  lose() {
    [0, -1, -2, -4].forEach((n, i) => this.tone(NOTE(62 + n), i === 3 ? 0.6 : 0.25, 'sawtooth', 0.06, i === 3 ? NOTE(55) : undefined, i * 0.25));
  }
  power() {
    [0, 7, 12, 19].forEach((n, i) => this.tone(NOTE(72 + n), 0.14, 'triangle', 0.09, NOTE(74 + n), i * 0.045));
  }
  fever() {
    [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => this.tone(NOTE(67 + n), 0.12, 'square', 0.07, undefined, i * 0.04));
    this.noise(0.4, 0.08, 6000, 'highpass');
  }
  counter() {
    this.tone(160, 0.25, 'square', 0.12, 60);
    [0, 7, 12].forEach((n, i) => this.tone(NOTE(79 + n), 0.1, 'square', 0.07, undefined, 0.05 + i * 0.05));
  }
  slam() {
    this.tone(70, 0.4, 'sine', 0.5, 30);
    this.noise(0.35, 0.35, 400, 'lowpass');
  }
  block() {
    this.tone(1300, 0.12, 'sine', 0.08, 1800);
  }
  buy() {
    [0, 7, 12].forEach((n, i) => this.tone(NOTE(76 + n), 0.1, 'triangle', 0.08, undefined, i * 0.05));
  }
  rescue() {
    // a chorus of tiny happy chirps
    for (let i = 0; i < 6; i++) this.tone(1200 + Math.random() * 900, 0.06, 'triangle', 0.05, 2200, i * 0.05);
    [0, 4, 7, 12].forEach((n, i) => this.tone(NOTE(76 + n), 0.12, 'square', 0.05, undefined, 0.1 + i * 0.06));
  }
  dash() {
    this.noise(0.45, 0.16, 1200, 'bandpass');
    this.tone(300, 0.4, 'sawtooth', 0.06, 1400);
  }
  milestone() {
    [0, 4, 7, 12, 16].forEach((n, i) => this.tone(NOTE(72 + n), 0.1, 'triangle', 0.08, undefined, i * 0.05));
    this.tone(NOTE(96), 0.3, 'sine', 0.05, undefined, 0.25);
  }
  tick() {
    this.tone(1800, 0.025, 'square', 0.03);
  }

  setMusic(mode: Mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (mode === 'off' || !this.ctx) return;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = window.setInterval(() => this.schedule(), 40);
  }

  private schedule() {
    const c = this.ctx;
    if (!c || this.mode === 'off') return;
    const song = SONGS[this.mode];
    const stepDur = 60 / (song.bpm * (this.party ? 1.12 : 1)) / 4;
    while (this.nextTime < c.currentTime + 0.12) {
      const i = this.step % 16;
      const at = this.nextTime - c.currentTime;
      if (song.bass[i]) this.tone(NOTE(song.bass[i]), stepDur * 1.6, 'triangle', 0.22, undefined, at, this.musicBus);
      // Every other bar the melody goes up an octave for variety.
      const lift = Math.floor(this.step / 16) % 2 ? 12 : 0;
      if (song.lead[i]) this.tone(NOTE(song.lead[i] + lift), stepDur * 0.9, 'square', 0.06, undefined, at, this.musicBus);
      const d = song.drums[i];
      if (d === 'k') this.tone(140, 0.12, 'sine', 0.35, 45, at, this.musicBus);
      if (d === 's') this.noise(0.1, 0.18, 2200, 'bandpass', this.nextTime, this.musicBus);
      if (d === 'h') this.noise(0.03, 0.08, 8000, 'highpass', this.nextTime, this.musicBus);
      this.nextTime += stepDur;
      this.step++;
    }
  }
}
