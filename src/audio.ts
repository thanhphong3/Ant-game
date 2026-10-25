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

  private silentEl: HTMLAudioElement | null = null;

  /**
   * Must run inside a user gesture (tap end / click / key). Mobile browsers
   * keep Web Audio silent until then, and iOS routes it through the ringer,
   * so the mute switch would silence the game unless we ask for "playback".
   */
  unlock() {
    const nav = navigator as any;
    if (nav.audioSession && nav.audioSession.type !== 'playback') {
      try {
        nav.audioSession.type = 'playback'; // iOS 16.4+: ignore the silent switch, like a video would
      } catch {
        /* not supported */
      }
    } else if (!nav.audioSession && /iP(hone|ad|od)|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document) {
      this.playSilence(); // older iOS: an <audio> element playing switches the session to playback
    }
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
      // Old WebKit only unlocks once something actually plays during the gesture.
      const blip = this.ctx.createBufferSource();
      blip.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      blip.connect(this.ctx.destination);
      blip.start(0);
      // Music asked for before audio existed (e.g. the menu tune) starts now.
      const want = this.mode;
      this.mode = 'off';
      this.setMusic(want);
    }
    // iOS also parks the context as "interrupted" after a call or an app switch.
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
    if (this.silentEl?.paused) this.silentEl.play().catch(() => {});
  }

  /** Pause everything while the tab is hidden; pick back up on return. */
  sleep(hidden: boolean) {
    if (!this.ctx) return;
    if (hidden) {
      this.ctx.suspend().catch(() => {});
      this.silentEl?.pause();
    } else {
      this.ctx.resume().catch(() => {});
      this.silentEl?.play().catch(() => {});
    }
  }

  private playSilence() {
    if (!this.silentEl) {
      // 0.1 s of 8 kHz silence as a WAV data URI, looped
      const n = 800;
      const buf = new ArrayBuffer(44 + n);
      const v = new DataView(buf);
      const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
      str(0, 'RIFF');
      v.setUint32(4, 36 + n, true);
      str(8, 'WAVEfmt ');
      v.setUint32(16, 16, true);
      v.setUint16(20, 1, true);
      v.setUint16(22, 1, true);
      v.setUint32(24, 8000, true);
      v.setUint32(28, 8000, true);
      v.setUint16(32, 1, true);
      v.setUint16(34, 8, true);
      str(36, 'data');
      v.setUint32(40, n, true);
      for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
      let bin = '';
      new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)));
      const el = new Audio(`data:audio/wav;base64,${btoa(bin)}`);
      el.loop = true;
      el.setAttribute('playsinline', '');
      el.setAttribute('x-webkit-airplay', 'deny');
      this.silentEl = el;
    }
    if (this.silentEl.paused) this.silentEl.play().catch(() => {});
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

  private nz(dur: number, vol: number, freq: number, type: BiquadFilterType, delay: number) {
    if (this.ctx) this.noise(dur, vol, freq, type, this.ctx.currentTime + delay);
  }

  /** Wind-up cue for a boss's signature move, so each one can be told apart by ear. */
  move(kind: string) {
    switch (kind) {
      case 'spider': // creaky web unspooling
        this.tone(1500, 0.6, 'triangle', 0.06, 260);
        for (let i = 0; i < 5; i++) this.tone(2400 - i * 300, 0.05, 'sine', 0.04, undefined, i * 0.1);
        break;
      case 'frog': // ribbit-ribbit, then a slurp
        this.tone(190, 0.12, 'square', 0.1, 120);
        this.tone(210, 0.12, 'square', 0.1, 130, 0.17);
        this.tone(300, 0.35, 'sine', 0.08, 1500, 0.38);
        break;
      case 'lizard': // three hissing beats
        for (let i = 0; i < 3; i++) this.nz(0.14, 0.14, 5000, 'highpass', i * 0.16);
        break;
      case 'mantis': // two blades sharpened
        this.nz(0.25, 0.12, 7000, 'bandpass', 0);
        this.tone(2600, 0.25, 'sawtooth', 0.03, 3600);
        this.nz(0.25, 0.12, 7000, 'bandpass', 0.28);
        this.tone(2600, 0.25, 'sawtooth', 0.03, 3600, 0.28);
        break;
      case 'bee': // angry buzzing swarm
        this.tone(210, 0.8, 'sawtooth', 0.06, 260);
        this.tone(216, 0.8, 'sawtooth', 0.05, 250);
        break;
      default: // beetle king: the ground starts to rumble
        this.tone(55, 1.0, 'sine', 0.35, 40);
        this.nz(1.0, 0.2, 160, 'lowpass', 0);
        break;
    }
  }

  /** The impact of a signature move. */
  moveHit(kind: string) {
    switch (kind) {
      case 'spider':
        this.tone(500, 0.2, 'triangle', 0.12, 120);
        this.nz(0.2, 0.15, 900, 'bandpass', 0);
        break;
      case 'frog': // THWAP
        this.tone(900, 0.12, 'square', 0.1, 150);
        this.nz(0.15, 0.25, 1400, 'bandpass', 0);
        break;
      case 'lizard':
        this.nz(0.12, 0.3, 2500, 'bandpass', 0);
        this.tone(160, 0.15, 'sine', 0.3, 60);
        break;
      case 'mantis': // shing!
        this.tone(3200, 0.3, 'triangle', 0.08, 1200);
        this.nz(0.2, 0.2, 6000, 'highpass', 0);
        break;
      case 'bee': // a patter of stingers
        for (let i = 0; i < 4; i++) this.tone(1800 - i * 200, 0.05, 'square', 0.06, 600, i * 0.04);
        break;
      default:
        this.tone(50, 0.7, 'sine', 0.55, 25);
        this.nz(0.6, 0.45, 300, 'lowpass', 0);
        break;
    }
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
  private lastChirp = 0;
  /** Tiny "voice" blip when an ant talks. */
  chirp() {
    if (!this.ctx || this.ctx.currentTime - this.lastChirp < 0.15) return;
    this.lastChirp = this.ctx.currentTime;
    const f = 900 + Math.random() * 500;
    this.tone(f, 0.05, 'triangle', 0.05, f * 1.4);
    this.tone(f * 1.2, 0.06, 'triangle', 0.045, f * 0.9, 0.06);
  }
  bugSpot() {
    [0, 7, 0, 7].forEach((n, i) => this.tone(NOTE(84 + n), 0.07, 'square', 0.05, undefined, i * 0.07));
  }
  jackpot() {
    [0, 4, 7, 12, 16, 19, 24, 28].forEach((n, i) => this.tone(NOTE(72 + n), 0.1, 'square', 0.06, undefined, i * 0.04));
    for (let i = 0; i < 8; i++) this.tone(2000 + Math.random() * 1500, 0.05, 'sine', 0.04, undefined, 0.3 + i * 0.05);
  }
  giant() {
    this.tone(400, 0.5, 'square', 0.08, 90);
    [0, 5, 12].forEach((n, i) => this.tone(NOTE(48 + n), 0.2, 'triangle', 0.15, undefined, 0.15 + i * 0.1));
  }
  private lastSmash = 0;
  smash() {
    if (!this.ctx || this.ctx.currentTime - this.lastSmash < 0.08) return;
    this.lastSmash = this.ctx.currentTime;
    this.tone(160, 0.2, 'sine', 0.4, 40);
    this.noise(0.18, 0.25, 900, 'lowpass');
    this.tone(700, 0.12, 'square', 0.05, 1400, 0.05);
  }
  revive() {
    [0, 4, 7, 11, 12, 16, 19, 24].forEach((n, i) => this.tone(NOTE(64 + n), 0.16, 'triangle', 0.08, undefined, i * 0.05));
    this.tone(NOTE(88), 0.5, 'sine', 0.05, NOTE(100), 0.4);
  }
  gift() {
    this.noise(0.25, 0.15, 3000, 'highpass');
    [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => this.tone(NOTE(72 + n), 0.14, 'square', 0.06, undefined, 0.1 + i * 0.06));
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
