import {
  INK, TAU, TRACK_HALF, drawAccessory, drawAnt, drawBeetle, drawBoostPad, drawBoss, drawCrumb, drawFood, drawFoot,
  drawFootShadow, drawGate, drawGround, drawJar, drawLadybug, drawObstacle, drawPowerUp, drawShield, drawSlamZone, drawSpeech, makeAntSprites,
  paint, rrect, setBoil, text,
  type AntSprites, type BossVisual,
} from './art';
import type { Sound } from './audio';
import { BOSSES, THEMES, type CaptainId } from './data';
import { COMBO_WORDS, chatLine, t, tr, type ChatKind } from './i18n';
import { BOOST_L, BOOST_W, applyGate, gateGood, gateLabel, revealMystery, slotOp, type GateOp, type Level, type Obstacle, type Squad } from './level';

export interface RunStats {
  startAnts: number;
  power: number;
  magnet: number;
  dodge: number;
  honeyMult: number;
  plusBoost: number;
  crumbHoneyMult: number;
  captain: CaptainId;
}

/** What happened during a run, for daily quests. */
export interface RunTally {
  crumbs: number;
  mystery: number;
  squads: number;
  foods: number;
  fever: number;
  counters: number;
  jars: number;
  powerups: number;
  boosts: number;
  maxAnts: number;
  bugs: number;
  smashed: number;
}

export interface RunResult {
  win: boolean;
  antsLeft: number;
  crumbHoney: number;
  fightHoney: number;
  foodHoney: number;
  bugHoney: number;
  bonus: number;
  stars: number;
  starBonus: number;
  total: number;
  tally: RunTally;
}

interface Ant {
  x: number;
  y: number; // world "d" coordinate
  k: number;
  wob: number;
  ft: number;
  ang: number;
  inv: number;
  pop: number;
}

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; max: number;
  kind: 'poof' | 'confetti' | 'spark' | 'heart' | 'crumb';
  color: string; size: number; rot: number;
}

interface FloatText { x: number; y: number; s: string; color: string; life: number; size: number }

/** A speech bubble over one of the ants. */
interface Chat { ant: Ant; s: string; life: number }

type Phase = 'ready' | 'run' | 'battle' | 'bossIntro' | 'boss' | 'win' | 'lose';

const VMAX = 220;
const SPACING = 9.5;
const ANT = 18;
const GOLDEN = 2.39996;
const SMOKE = '#e3d9ee';
const FEVER_COMBO = 10;
const POWER_TIME = { shield: 6, magnet: 7, rage: 8, giant: 6 } as const;
const GIANT = 1.5;
const CHAT_LIFE = 1.3;
const SLAM_WARN = 1.0;
const RAGE_WARN = 0.8;
const DASH_TIME = 1.8;
const DASH_SPEED = 1.9;
const MILESTONES = [25, 50, 100, 150, 200, 300, 500, 1000];
type SlamSide = -1 | 0 | 1;

const buzz = (ms: number | number[]) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* no haptics */
  }
};

export class Run {
  time = 0;
  phase: Phase = 'ready';
  paused = false;
  d = 0;
  x = 0;
  targetX = 0;
  count: number;
  ants: Ant[] = [];
  parts: Particle[] = [];
  texts: FloatText[] = [];
  shake = 0;
  camD = 0;
  phaseT = 0;
  combo = 0;
  comboT = 0;
  crumbHoney = 0;
  fightHoney = 0;
  foodHoney = 0;
  bugHoney = 0;
  bossHP: number;
  bossMax: number;
  bossV: BossVisual = { hurt: 0, attack: 0, dead: false, rage: false };
  private lastHurt = 0;
  // timed buffs (seconds left)
  shieldT = 0;
  magnetT = 0;
  rageT = 0;
  giantT = 0;
  feverT = 0;
  dashT = 0;
  revives = 0;
  private resumePhase: Phase = 'run';
  private chats: Chat[] = [];
  private chatCD = 0;
  private bossLine: { s: string; life: number } | null = null;
  // boss slam: side of the arena about to be smashed (0 = the middle), its countdown,
  // and an optional quick follow-up on another side
  slam: { side: SlamSide; t: number; hit: number; warn: number; follow: SlamSide | null } | null = null;
  slamCD = 0.6;
  slamCount = 0;
  battle: Squad | null = null;
  tickAcc = 0;
  ended = false;
  tally: RunTally = { crumbs: 0, mystery: 0, squads: 0, foods: 0, fever: 0, counters: 0, jars: 0, powerups: 0, boosts: 0, maxAnts: 0, bugs: 0, smashed: 0 };
  private milestone = 0;
  private rageBanner = 0;
  private slotHinted = false;
  private slotFace = -1;
  private spr: AntSprites;
  private capSpr: AntSprites;
  private goldSpr: AntSprites;
  private rageSpr: AntSprites;
  private keys = { left: false, right: false };
  private drag: { px: number; tx: number } | null = null;
  private scale = 1;
  private result: RunResult | null = null;

  constructor(
    public lv: Level,
    public stats: RunStats,
    private sound: Sound,
    private onEnd: (r: RunResult) => void,
  ) {
    this.count = stats.startAnts;
    this.bossHP = this.bossMax = lv.bossHP;
    this.spr = makeAntSprites();
    this.capSpr = makeAntSprites('#4a3558', 'rgba(255,255,255,0.7)');
    this.goldSpr = makeAntSprites('#d9961a', 'rgba(255,255,230,0.85)');
    this.rageSpr = makeAntSprites('#c23a4a', 'rgba(255,220,220,0.7)');
    this.syncAnts(0, -20);
    for (const a of this.ants) {
      a.pop = 1;
    }
    this.tally.maxAnts = this.count;
    while (this.milestone < MILESTONES.length && MILESTONES[this.milestone] <= this.count) this.milestone++;
  }

  get stopD() {
    return this.lv.length - 170;
  }
  get bossD() {
    return this.lv.length + 70;
  }
  get radius() {
    return SPACING * Math.sqrt(this.ants.length + 1.5);
  }
  /** Swarm centre during the boss fight: steering still works so slams can be dodged. */
  get bossCx() {
    return this.x * 0.75;
  }
  get bossCy() {
    return this.bossD - 90 - this.radius * 0.6;
  }
  get power() {
    return this.stats.power * (this.rageT > 0 ? 2 : 1) * (this.giantT > 0 ? 1.5 : 1);
  }

  // ------------------------------------------------------------ input
  pointerDown(px: number) {
    this.drag = { px, tx: this.targetX };
    this.start();
  }
  pointerMove(px: number) {
    if (!this.drag) return;
    this.targetX = this.drag.tx + ((px - this.drag.px) / this.scale) * 1.25;
  }
  pointerUp() {
    this.drag = null;
  }
  key(code: string, down: boolean) {
    if (code === 'ArrowLeft' || code === 'KeyA') this.keys.left = down;
    else if (code === 'ArrowRight' || code === 'KeyD') this.keys.right = down;
    else return;
    if (down) this.start();
  }
  private start() {
    if (this.phase === 'ready') {
      this.phase = 'run';
      this.sound.setMusic('run');
    }
  }

  // ------------------------------------------------------------ swarm bookkeeping
  private slot(i: number) {
    const r = SPACING * Math.sqrt(i + 1.5);
    const a = i * GOLDEN;
    return { ox: Math.cos(a) * r, oy: Math.sin(a) * r };
  }

  /** Keep visible ants in step with count. New ants spawn at (sx, sy). */
  private syncAnts(sx: number, sy: number) {
    const want = Math.max(0, Math.min(VMAX, Math.floor(this.count)));
    while (this.ants.length > want) {
      const a = this.ants.pop()!;
      this.poof(a.x, a.y, SMOKE, 3);
    }
    while (this.ants.length < want) {
      this.ants.push({
        x: sx + (Math.random() - 0.5) * 6,
        y: sy + (Math.random() - 0.5) * 6,
        k: 6 + Math.random() * 5,
        wob: Math.random() * TAU,
        ft: Math.random() * 4,
        ang: 0,
        inv: 0,
        pop: 0,
      });
    }
  }

  private killAnt(i: number) {
    const a = this.ants[i];
    this.poof(a.x, a.y, SMOKE, 4);
    const ratio = Math.max(1, Math.round(this.count / Math.max(1, this.ants.length)));
    this.ants.splice(i, 1);
    this.count = Math.max(0, this.count - ratio);
    this.sound.poof();
    this.syncAnts(this.x, this.d);
  }

  private addCount(n: number, sx: number, sy: number) {
    this.count = Math.max(0, Math.round(this.count + n));
    this.syncAnts(sx, sy);
    if (n > 0) this.checkMilestone();
  }

  /** Celebrate when the swarm first grows past 25, 50, 100... ants. */
  private checkMilestone() {
    this.tally.maxAnts = Math.max(this.tally.maxAnts, this.count);
    if (this.milestone >= MILESTONES.length || this.count < MILESTONES[this.milestone]) return;
    while (this.milestone < MILESTONES.length && this.count >= MILESTONES[this.milestone]) this.milestone++;
    this.sound.milestone();
    this.confetti(this.x, this.d, 20);
    this.float(this.x, this.d + this.radius + 75, `🐜 ${t('milestone', MILESTONES[this.milestone - 1])}`, '#7ed6ff', 30);
    this.chat('good');
  }

  /** One ant near the middle of the swarm pipes up (rate-limited so it stays cute, not noisy). */
  private chat(kind: ChatKind, chance = 1) {
    if (this.chatCD > 0 || !this.ants.length || Math.random() > chance) return;
    const ant = this.ants[Math.floor(Math.random() * Math.min(this.ants.length, 25))];
    this.chats.push({ ant, s: chatLine(kind), life: 0 });
    if (this.chats.length > 3) this.chats.shift();
    this.chatCD = 0.8;
    this.sound.chirp();
  }

  private bossSay(kind: ChatKind) {
    this.bossLine = { s: chatLine(kind), life: 0 };
  }

  // ------------------------------------------------------------ fx
  private poof(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const s = 30 + Math.random() * 70;
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 0.3 + Math.random() * 0.2, kind: 'poof', color, size: 2 + Math.random() * 3, rot: 0 });
    }
  }
  private sparkle(x: number, y: number, color: string, n = 6) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const s = 40 + Math.random() * 60;
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 0.5, kind: 'spark', color, size: 3 + Math.random() * 2, rot: a });
    }
  }
  private confetti(x: number, y: number, n: number) {
    const cols = ['#ff7eb6', '#7ed6ff', '#ffd166', '#b5f27a', '#c7b3ff'];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const s = 80 + Math.random() * 220;
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s + 120, life: 0, max: 1.4 + Math.random(), kind: 'confetti', color: cols[i % 5], size: 4 + Math.random() * 3, rot: Math.random() * 6 });
    }
  }
  private float(x: number, y: number, s: string, color = '#fff', size = 22) {
    // keep wide labels on screen when the swarm hugs a wall
    const lim = Math.max(0, TRACK_HALF + 10 - [...s].length * size * 0.27);
    this.texts.push({ x: Math.max(-lim, Math.min(lim, x)), y, s, color, life: 0, size });
  }

  // ------------------------------------------------------------ update
  update(dt: number) {
    if (this.paused) return;
    dt = Math.min(dt, 1 / 30);
    this.time += dt;
    this.phaseT += dt;
    setBoil(this.time);
    const lv = this.lv;

    // steering
    if (this.keys.left) this.targetX -= 330 * dt;
    if (this.keys.right) this.targetX += 330 * dt;
    const lim = Math.max(0, TRACK_HALF - Math.min(this.radius * 0.85, TRACK_HALF));
    this.targetX = Math.max(-lim, Math.min(lim, this.targetX));

    let speed = 0;
    if (this.phase === 'run') speed = lv.speed * (this.dashT > 0 ? DASH_SPEED : 1);
    if (this.phase === 'bossIntro') speed = this.d < this.stopD ? lv.speed : 0;
    this.d = Math.min(this.d + speed * dt, this.phase === 'run' || this.phase === 'bossIntro' ? this.stopD : this.d);
    if (this.phase !== 'win') this.x += (this.targetX - this.x) * Math.min(1, dt * 9);

    this.comboT -= dt;
    if (this.comboT <= 0) this.combo = 0;
    this.shieldT = Math.max(0, this.shieldT - dt);
    this.magnetT = Math.max(0, this.magnetT - dt);
    this.rageT = Math.max(0, this.rageT - dt);
    this.feverT = Math.max(0, this.feverT - dt);
    this.dashT = Math.max(0, this.dashT - dt);
    this.giantT = Math.max(0, this.giantT - dt);
    this.chatCD -= dt;
    this.rageBanner = Math.max(0, this.rageBanner - dt);
    if (this.dashT > 0 && Math.random() < dt * 30) this.poof(this.x + (Math.random() - 0.5) * this.radius * 1.6, this.d - this.radius * 0.8, '#ffffff', 1);
    if (this.feverT > 0 && Math.random() < dt * 10) this.sparkle(this.x + (Math.random() - 0.5) * this.radius * 2, this.d + (Math.random() - 0.5) * this.radius * 2, '#ffd166', 1);

    if (this.phase === 'run') {
      this.updatePickups();
      this.updateBoosts();
      this.updateGates(dt);
      this.updateHazards(dt);
      this.updateSquadContact();
      this.updateFoods();
      this.updateJars();
      this.updateBugs(dt);
      if (this.d >= lv.length - 380) {
        this.phase = 'bossIntro';
        this.phaseT = 0;
        this.bossSay('taunt');
        this.sound.roar();
        this.sound.setMusic('boss');
        this.shake = 10;
      }
    } else if (this.phase === 'battle') {
      this.updateBattle(dt);
    } else if (this.phase === 'bossIntro') {
      this.updatePickups();
      if (this.d >= this.stopD && this.phaseT > 1.6) {
        this.phase = 'boss';
        this.phaseT = 0;
        this.tickAcc = 0;
        this.chat('boss');
      }
    } else if (this.phase === 'boss') {
      this.updateBoss(dt);
    } else if (this.phase === 'win' || this.phase === 'lose') {
      if (this.phaseT > (this.phase === 'win' ? 2.4 : 1.6) && !this.ended) {
        this.ended = true;
        this.onEnd(this.result!);
      }
      if (this.phase === 'win' && Math.random() < dt * 4) this.confetti(this.x + (Math.random() - 0.5) * 300, this.d + 200, 10);
    }

    // foods being carried away
    for (const f of lv.foods) {
      if (f.state === 'carried') {
        f.anim += dt;
        f.x += Math.sign(f.x || 1) * 60 * dt;
      }
    }
    for (const j of lv.jars) if (j.open) j.anim += dt;
    for (const b of lv.bugs) if (b.state === 'gone' || b.state === 'caught') b.t += dt;

    this.updateAnts(dt, speed);
    this.updateFx(dt);

    // camera
    let camT = this.d + 40;
    if (this.phase === 'bossIntro' || this.phase === 'boss' || this.phase === 'win' || (this.phase === 'lose' && this.d > this.lv.length - 400)) {
      camT = (this.stopD + this.bossD) / 2 - 60;
    }
    this.camD += (camT - this.camD) * Math.min(1, dt * (this.phase === 'run' ? 12 : 3));
    this.shake = Math.max(0, this.shake - dt * 30);
    this.bossV.hurt = Math.max(0, this.bossV.hurt - dt * 6);
    this.bossV.attack = Math.max(0, this.bossV.attack - dt * 3);

    if (this.count <= 0 && this.phase !== 'lose' && this.phase !== 'win' && this.phase !== 'ready') this.lose();
  }

  private updateAnts(dt: number, speed: number) {
    let cx = this.x;
    let cy = this.d;
    let spread = 1;
    if (this.phase === 'battle' && this.battle) {
      cx = (this.x + this.battle.x) / 2;
      cy = (this.d + this.battle.d) / 2 - 10;
      spread = 0.75;
    } else if (this.phase === 'boss') {
      cx = this.bossCx;
      cy = this.bossCy;
      spread = 0.8;
    }
    if (this.giantT > 0) spread *= 1.3;
    const dance = this.phase === 'win';
    for (let i = 0; i < this.ants.length; i++) {
      const a = this.ants[i];
      const s = this.slot(i);
      let tx = cx + s.ox * spread + Math.sin(this.time * 3 + a.wob) * 1.6;
      let ty = cy + s.oy * spread + Math.cos(this.time * 2.6 + a.wob) * 1.6;
      if (this.phase === 'boss' || this.phase === 'battle') ty += Math.abs(Math.sin(this.time * 9 + a.wob)) * 8;
      if (dance) ty += Math.abs(Math.sin(this.time * 7 + i)) * 10;
      const px = a.x;
      const py = a.y;
      const k = Math.min(1, dt * a.k);
      a.x += (tx - a.x) * k;
      a.y += (ty - a.y) * k + speed * dt * 0.85;
      a.x = Math.max(-TRACK_HALF + 5, Math.min(TRACK_HALF - 5, a.x));
      const vx = (a.x - px) / dt;
      const vy = (a.y - py) / dt;
      const target = dance ? Math.sin(this.time * 8 + i) * 0.5 : Math.atan2(vx, Math.max(40, vy)) * 0.9;
      a.ang += (target - a.ang) * Math.min(1, dt * 10);
      a.ft += dt * (Math.abs(vx) + Math.abs(vy) > 20 || speed > 0 ? 14 : 3);
      a.inv = Math.max(0, a.inv - dt);
      a.pop = Math.min(1, a.pop + dt * 5);
    }
  }

  private updatePickups() {
    const fever = this.feverT > 0;
    const R = this.radius + 8 + this.stats.magnet + (this.magnetT > 0 ? 110 : 0) + (fever ? 25 : 0) + (this.dashT > 0 ? 40 : 0);
    const PR = this.radius + 22;
    for (const p of this.lv.powerups) {
      if (p.taken || Math.abs(p.d - this.d) > PR + 10) continue;
      const dx = p.x - this.x;
      const dy = p.d - this.d;
      if (dx * dx + dy * dy > PR * PR) continue;
      p.taken = true;
      this.tally.powerups++;
      if (p.kind === 'shield') this.shieldT = POWER_TIME.shield;
      else if (p.kind === 'magnet') this.magnetT = POWER_TIME.magnet;
      else if (p.kind === 'rage') this.rageT = POWER_TIME.rage;
      else {
        this.giantT = POWER_TIME.giant;
        this.sound.giant();
        this.shake = 10;
        this.chatCD = 0;
        this.chat('giant');
      }
      this.sound.power();
      buzz(30);
      this.sparkle(p.x, p.d, p.kind === 'shield' ? '#7ed6ff' : p.kind === 'magnet' ? '#ff7eb6' : p.kind === 'giant' ? '#b5f27a' : '#ffb347', 18);
      this.float(this.x, this.d + this.radius + 50, t(p.kind), '#fff', 24);
    }
    for (const c of this.lv.crumbs) {
      if (c.taken || c.d < this.d - R - 30 || c.d > this.d + R + 30) continue;
      const dx = c.x - this.x;
      const dy = c.d - this.d;
      if (dx * dx + dy * dy < R * R) {
        c.taken = true;
        this.tally.crumbs++;
        this.combo++;
        this.comboT = fever ? 1.2 : 0.7;
        const gain = c.value * (fever ? 2 : 1);
        this.addCount(gain, c.x, c.d);
        this.crumbHoney += gain * this.stats.crumbHoneyMult;
        this.sound.pick(this.combo);
        this.sparkle(c.x, c.d, c.kind === 'candy' ? '#ff7eb6' : '#ffd166', c.kind === 'bread' ? 3 : 7);
        if (gain > 1) this.float(c.x, c.d + 10, `+${gain}`, '#ffd166', 18);
        if (this.combo % FEVER_COMBO === 0) {
          // Fever: double ants per crumb, longer combo window, bigger pickup reach.
          this.feverT = 5;
          this.tally.fever++;
          this.sound.fever();
          buzz([20, 40, 20]);
          this.confetti(this.x, this.d, 30);
          this.float(this.x, this.d + this.radius + 60, t('fever'), '#ffd166', 38);
        } else if (COMBO_WORDS[this.combo]) {
          this.float(this.x, this.d + this.radius + 40, tr(COMBO_WORDS[this.combo]), '#ff7eb6', 24 + Math.min(this.combo, 45) * 0.25);
          if (this.combo >= 25) this.confetti(this.x, this.d, 12);
        } else this.chat('munch', 0.05);
      }
    }
  }

  private updateGates(dt: number) {
    for (const g of this.lv.gates) {
      if (g.chosen) {
        g.used += dt;
        continue;
      }
      if (g.slot && g.d - this.d < 340) {
        // tick-tock as the reel flips, so the timing can be heard as well as seen
        const face = Math.floor(this.time / g.slot.period);
        if (face !== this.slotFace) {
          this.slotFace = face;
          this.sound.tick();
        }
        if (!this.slotHinted) {
          this.slotHinted = true;
          this.float(g.slot.side * TRACK_HALF * 0.5, g.d + 60, t('slotHint'), '#fff', 20);
        }
      }
      if (this.d < g.d) continue;
      g.chosen = this.x < 0 ? -1 : 1;
      g.used = 0.001;
      if (g.slot) {
        // the reel stops on whatever face is showing right now
        const face = slotOp(g.slot, this.time);
        if (g.slot.side < 0) g.left = face;
        else g.right = face;
        g.slot = undefined;
      }
      let op = g.chosen < 0 ? g.left : g.right;
      const before = this.count;
      const mystery = op.op === '?';
      if (mystery) {
        this.tally.mystery++;
        op = revealMystery(before, Math.random);
        if (g.chosen < 0) g.left = op;
        else g.right = op;
      }
      const after = applyGate(before, op, op.op === '+' ? this.stats.plusBoost : 1);
      const gx = g.chosen * TRACK_HALF * 0.5;
      this.addCount(after - before, gx, g.d);
      const good = gateGood(op);
      this.float(gx, g.d + 20, gateLabel(op), good ? '#b5f27a' : '#ff8a80', 34);
      if (mystery) this.float(gx, g.d + 60, `❓ ${t('mystery')}`, '#c7b3ff', 20);
      if (good) {
        this.sound.gateGood();
        this.sparkle(gx, g.d, '#b5f27a', 14);
        if (mystery) this.confetti(gx, g.d, 24);
        this.chat('good', 0.8);
      } else {
        this.sound.gateBad();
        this.shake = 6;
        buzz(60);
        this.chatCD = 0;
        this.chat('bad');
      }
    }
  }

  private updateHazards(dt: number) {
    const st = this.stats;
    // obstacles
    for (const o of this.lv.obstacles) {
      if (o.smashed || Math.abs(o.d - this.d) > 260) continue;
      const ox = o.x + (o.move ? Math.sin(this.time * o.move.speed + o.move.phase) * o.move.amp : 0);
      if (this.giantT > 0) {
        // giants just walk over everything, flattening whatever they touch
        const R = this.radius * 1.3 + 8;
        if (o.colliders.some((c) => (ox + c.dx - this.x) ** 2 + (o.d - c.dy - this.d) ** 2 < (R + c.r) ** 2)) this.smashObstacle(o, ox);
        continue;
      }
      for (const c of o.colliders) {
        const cx = ox + c.dx;
        const cy = o.d - c.dy;
        const rr = (c.r + 3) * (c.r + 3);
        for (let i = this.ants.length - 1; i >= 0; i--) {
          const a = this.ants[i];
          const dx = a.x - cx;
          const dy = a.y - cy;
          const d2 = dx * dx + dy * dy;
          if (d2 >= rr || a.inv > 0) continue;
          const shielded = this.shieldT > 0;
          if (shielded || this.dashT > 0 || Math.random() < st.dodge) {
            const l = Math.sqrt(d2) || 1;
            a.x = cx + (dx / l) * (c.r + 6);
            a.y = cy + (dy / l) * (c.r + 6);
            a.inv = 0.5;
            if (this.dashT > 0) {
              /* dashing ants just bounce off */
            } else if (shielded) {
              if (Math.random() < 0.15) {
                this.float(a.x, a.y + 10, t('blocked'), '#7ed6ff', 14);
                this.sound.block();
              }
            } else if (Math.random() < 0.25) this.float(a.x, a.y + 10, t('dodge'), '#7ed6ff', 14);
          } else {
            this.killAnt(i);
            this.chat('hurt', 0.12);
          }
        }
      }
    }
    // giant foot
    for (const s of this.lv.stomps) {
      if (s.state === 'wait' && this.d >= s.trigger - 330) {
        s.state = 'warn';
        s.timer = 0;
        s.x = Math.max(-TRACK_HALF + 60, Math.min(TRACK_HALF - 60, this.x));
        s.d = this.d + this.lv.speed * 1.15 + 10;
        this.sound.warn();
        this.float(s.x, s.d + 60, t('stomp'), '#ff8a80', 22);
      }
      if (s.state === 'warn' || s.state === 'down' || s.state === 'up') s.timer += dt;
      if (s.state === 'warn' && s.timer > 1.15) {
        s.state = 'down';
        s.timer = 0;
        this.sound.stomp();
        this.shake = 16;
        buzz(80);
        this.poof(s.x, s.d, '#c7b3ff', 18);
        if (this.shieldT > 0 || this.dashT > 0 || this.giantT > 0) {
          this.float(s.x, s.d + 40, this.giantT > 0 ? '💪' : t('blocked'), '#7ed6ff', 22);
          this.sound.block();
          continue;
        }
        const rx = 58;
        const ry = 58 * 1.3;
        for (let i = this.ants.length - 1; i >= 0; i--) {
          const a = this.ants[i];
          const nx = (a.x - s.x) / rx;
          const ny = (a.y - s.d) / ry;
          if (nx * nx + ny * ny < 1) {
            if (Math.random() < st.dodge) continue;
            this.killAnt(i);
          }
        }
      }
      if (s.state === 'down' && s.timer > 0.45) {
        s.state = 'up';
        s.timer = 0;
      }
      if (s.state === 'up' && s.timer > 0.5) s.state = 'done';
    }
  }

  private updateSquadContact() {
    const R = this.radius;
    for (const s of this.lv.squads) {
      if (s.dead) continue;
      const sr = 14 + Math.sqrt(Math.min(s.hp, 40)) * 9;
      const dx = s.x - this.x;
      const dy = s.d - this.d;
      if (dx * dx + dy * dy < (R + sr) * (R + sr)) {
        this.phase = 'battle';
        this.battle = s;
        this.tickAcc = 0;
        this.sound.hit();
        this.chat('boss', 0.6);
        return;
      }
    }
  }

  private updateBattle(dt: number) {
    const s = this.battle!;
    const rate = Math.max(9, (this.count + s.hp) / 1.3);
    this.tickAcc += dt * rate;
    while (this.tickAcc >= 1 && s.hp > 0 && this.count > 0) {
      this.tickAcc -= 1;
      s.hp -= this.power;
      this.count -= 1;
      this.syncAnts(this.x, this.d);
      const mx = (this.x + s.x) / 2 + (Math.random() - 0.5) * 30;
      const my = (this.d + s.d) / 2 + (Math.random() - 0.5) * 20;
      this.poof(mx, my, Math.random() < 0.5 ? '#c7b3ff' : SMOKE, 3);
      this.sound.hit();
    }
    this.shake = Math.max(this.shake, 2);
    if (this.count <= 0) return;
    if (s.hp <= 0) {
      s.dead = true;
      s.hp = 0;
      this.tally.squads++;
      this.fightHoney += s.reward;
      this.float(s.x, s.d + 30, `+${s.reward} 🍯`, '#ffd166', 24);
      this.sparkle(s.x, s.d, '#c7b3ff', 16);
      this.sound.gateGood();
      this.phase = 'run';
      this.battle = null;
    }
  }

  private updateFoods() {
    const R = this.radius;
    for (const f of this.lv.foods) {
      if (f.state !== 'idle') continue;
      const dx = f.x - this.x;
      const dy = f.d - this.d;
      if (dx * dx + dy * dy > (R + f.r) * (R + f.r)) continue;
      if (this.count >= f.need) {
        f.state = 'carried';
        this.tally.foods++;
        this.addCount(-f.carriers, f.x, f.d);
        this.foodHoney += f.value;
        this.sound.carry();
        this.float(f.x, f.d + 50, t('carried', f.value), '#ffd166', 18);
        this.sparkle(f.x, f.d, '#ffd166', 16);
        this.chat('good', 0.7);
      } else {
        f.state = 'nope';
        this.sound.nope();
        this.chat('bad', 0.7);
        this.float(f.x, f.d + 50, t('needAnts', f.need), '#ff8a80', 18);
      }
    }
  }

  private updateJars() {
    const R = this.radius + 24;
    for (const j of this.lv.jars) {
      if (j.open) continue;
      const dx = j.x - this.x;
      const dy = j.d - this.d;
      if (dx * dx + dy * dy > R * R) continue;
      j.open = true;
      this.tally.jars++;
      this.addCount(j.n, j.x, j.d);
      this.sound.rescue();
      buzz([20, 30, 20]);
      this.confetti(j.x, j.d, 26);
      this.sparkle(j.x, j.d, '#b5f27a', 14);
      this.float(j.x, j.d + 50, t('rescue', j.n), '#b5f27a', 24);
      this.chatCD = 0;
      this.chat('rescue');
    }
  }

  private smashObstacle(o: Obstacle, ox: number) {
    o.smashed = true;
    this.tally.smashed++;
    const honey = 5 + this.lv.num;
    this.fightHoney += honey;
    this.sound.smash();
    buzz(40);
    this.shake = Math.max(this.shake, 9);
    this.poof(ox, o.d, '#c7b3ff', 14);
    this.sparkle(ox, o.d, '#b5f27a', 10);
    this.float(ox, o.d + 30, `${t('smash')} +${honey}🍯`, '#b5f27a', 26);
    this.chat('giant', 0.35);
    // a little shower of sugar where the junk used to be
    for (let i = 0; i < 4; i++) {
      this.lv.crumbs.push({ kind: 'sugar', x: ox + (Math.random() - 0.5) * 60, d: o.d + 20 + i * 18, value: 2, taken: false, seed: 900 + Math.floor(Math.random() * 999) });
    }
  }

  private updateBugs(dt: number) {
    const H = TRACK_HALF - 26;
    for (const b of this.lv.bugs) {
      if (b.state === 'caught' || b.state === 'gone') continue;
      if (b.state === 'idle') {
        if (b.d - this.d > 290) continue;
        b.state = 'run';
        b.t = 0;
        b.vx = 0;
        this.sound.bugSpot();
        this.float(b.x, b.d + 60, t('bugSpot'), '#ffd166', 20);
        this.chatCD = 0;
        this.chat('bug');
      }
      b.t += dt;
      // a bit slower than the swarm, so a chase lasts a few seconds (a dash closes it fast)
      b.d += this.lv.speed * 0.62 * dt;
      b.juke -= dt;
      if (b.juke <= 0) {
        if (Math.abs(b.x) > H - 12 && Math.abs(this.x - b.x) < 150 && Math.sign(this.x || 1) === Math.sign(b.x)) {
          // cornered: dart right past the swarm to the other side!
          b.juke = 0.55;
          b.vx = -Math.sign(b.x) * 330;
        } else {
          const away = b.x >= this.x ? 1 : -1;
          const want = away * 150 + Math.sin(b.t * 5 + b.seed) * 90;
          b.vx += (want - b.vx) * Math.min(1, dt * 5);
        }
      }
      b.x = Math.max(-H, Math.min(H, b.x + b.vx * dt));
      b.drop -= dt;
      if (b.drop <= 0) {
        b.drop = 0.2;
        this.lv.crumbs.push({ kind: Math.random() < 0.25 ? 'candy' : 'sugar', x: b.x, d: b.d - 10, value: 1, taken: false, seed: b.seed * 31 + Math.floor(b.t * 50) });
      }
      const R = this.radius + 18;
      if ((b.x - this.x) ** 2 + (b.d - this.d) ** 2 < R * R) {
        b.state = 'caught';
        b.t = 0;
        this.tally.bugs++;
        const honey = 30 + this.lv.num * 6;
        this.bugHoney += honey;
        this.sound.jackpot();
        buzz([30, 40, 30, 40, 60]);
        this.shake = 8;
        this.confetti(b.x, b.d, 40);
        this.sparkle(b.x, b.d, '#ffd166', 20);
        this.float(b.x, b.d + 60, t('bugCaught', honey), '#ffd166', 30);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU;
          this.lv.crumbs.push({ kind: 'sugar', x: b.x + Math.cos(a) * 30, d: b.d + Math.sin(a) * 30, value: 2, taken: false, seed: b.seed + i });
        }
        this.chatCD = 0;
        this.chat('good');
      } else if (b.t > 5.5 || b.d > this.lv.length - 430) {
        b.state = 'gone';
        b.t = 0;
        this.float(b.x, b.d + 40, `🐞 ${t('bugGone')}`, '#fff', 18);
        this.chat('bad', 0.6);
      }
    }
  }

  private updateBoosts() {
    for (const b of this.lv.boosts) {
      if (b.used || this.d < b.d || this.d > b.d + BOOST_L) continue;
      if (Math.abs(this.x - b.x) > BOOST_W / 2 + this.radius * 0.4) continue;
      b.used = true;
      this.dashT = DASH_TIME;
      this.tally.boosts++;
      this.sound.dash();
      buzz(40);
      this.shake = 5;
      this.float(this.x, this.d + this.radius + 50, `⚡ ${t('dash')}`, '#7ed6ff', 30);
      this.chatCD = 0;
      this.chat('dash');
    }
  }

  private updateBoss(dt: number) {
    // Slower than a squad fight so there is time to dodge the boss's slams.
    const rate = Math.max(8, (this.count + this.bossHP) / 9);
    this.tickAcc += dt * rate;
    while (this.tickAcc >= 1 && this.bossHP > 0 && this.count > 0) {
      this.tickAcc -= 1;
      this.bossHP -= this.power;
      this.count -= 1;
      if (this.time - this.lastHurt > 0.22) {
        this.bossV.hurt = 1;
        this.lastHurt = this.time;
      }
      this.syncAnts(this.x, this.d);
      const bx = (Math.random() - 0.5) * 120;
      this.poof(bx, this.bossD - 50 + Math.random() * 30, '#ffffff', 2);
      this.sound.hit();
    }
    this.updateSlam(dt);
    if (!this.bossV.rage && this.bossHP > 0 && this.bossHP <= this.bossMax * 0.5) {
      // Second phase: faster slams, middle smashes and one-two combos.
      this.bossV.rage = true;
      this.sound.roar();
      this.shake = 12;
      buzz([30, 30, 60]);
      this.rageBanner = 1.8;
      this.slamCD = Math.min(this.slamCD, 0.5);
      this.bossSay('rage');
    }
    if (this.bossHP <= 0 && this.count > 0) this.win();
  }

  /** Arena x-range a slam on `side` covers: a side slam spares the middle strip, a middle slam spares both edges. */
  slamRange(side: SlamSide): [number, number] {
    if (side === 0) return [-50, 50];
    return side < 0 ? [-TRACK_HALF, -22] : [22, TRACK_HALF];
  }

  private updateSlam(dt: number) {
    const rage = this.bossV.rage;
    if (this.slam) {
      const sl = this.slam;
      if (sl.hit > 0) {
        sl.hit -= dt;
        if (sl.hit <= 0) {
          this.slam = sl.follow === null ? null : { side: sl.follow, t: 0, hit: 0, warn: 0.65, follow: null };
          if (this.slam) this.sound.warn();
        }
        return;
      }
      sl.t += dt;
      if (sl.t < sl.warn) return;
      // SMASH
      sl.hit = 0.3;
      this.bossV.attack = 1;
      this.shake = 16;
      this.sound.slam();
      buzz(90);
      const [x0, x1] = this.slamRange(sl.side);
      for (let i = 0; i < 10; i++) this.poof(x0 + Math.random() * (x1 - x0), this.bossCy + (Math.random() - 0.5) * 120, SMOKE, 2);
      const inZone = this.ants.filter((a) => a.x > x0 && a.x < x1).length;
      const frac = this.ants.length ? inZone / this.ants.length : 0;
      // A clean dodge (a couple of stragglers is fine) earns a counter-attack.
      if (frac < 0.05 || this.shieldT > 0) {
        const dmg = Math.max(2, Math.round(this.bossMax * 0.07 * (this.rageT > 0 ? 1.5 : 1)));
        this.bossHP -= dmg;
        this.tally.counters++;
        this.bossV.hurt = 1;
        this.sound.counter();
        this.float(0, this.bossD - 60, `${t('counter')} -${dmg}`, '#ffd166', 30);
        this.sparkle(0, this.bossD - 40, '#ffd166', 20);
        this.chat('good', 0.5);
      } else {
        const lost = Math.max(1, Math.round(this.count * frac * 0.22 * (1 - this.stats.dodge * 0.5)));
        for (const a of this.ants) if (a.x > x0 && a.x < x1 && Math.random() < 0.5) this.poof(a.x, a.y, SMOKE, 2);
        this.addCount(-lost, this.bossCx, this.bossCy);
        this.float((x0 + x1) / 2, this.bossCy + 40, `${t('ouch')} -${lost}`, '#ff8a80', 24);
        this.chatCD = 0;
        this.chat('hurt', 0.8);
      }
      this.slamCD = rage ? 0.45 + Math.random() * 0.35 : 0.7 + Math.random() * 0.5;
      return;
    }
    this.slamCD -= dt;
    if (this.slamCD > 0) return;
    // Aim at the side holding most of the swarm, so the player has to move.
    let side: SlamSide = Math.abs(this.bossCx) < 12 ? (Math.random() < 0.5 ? -1 : 1) : this.bossCx < 0 ? -1 : 1;
    let follow: SlamSide | null = null;
    if (rage) {
      const k = Math.random();
      if (Math.abs(this.bossCx) < 45 && k < 0.6) side = 0; // hiding in the middle stops working
      else if (k < 0.35) follow = side < 0 ? 1 : -1; // one-two: this side, then the other
    }
    this.slam = { side, t: 0, hit: 0, warn: rage ? RAGE_WARN : SLAM_WARN, follow };
    this.sound.warn();
    if (this.slamCount++ === 0) this.float(0, this.bossCy + 80, t('bossDodge'), '#fff', 20);
  }

  private win() {
    this.bossHP = 0;
    this.bossV.dead = true;
    this.phase = 'win';
    this.phaseT = 0;
    this.sound.win();
    this.sound.setMusic('menu');
    this.confetti(0, this.bossD, 80);
    this.shake = 14;
    const st = this.stats;
    const antsLeft = Math.floor(this.count);
    buzz([40, 60, 40, 60, 120]);
    this.slam = null;
    this.bossSay('bossWin');
    this.chatCD = 0;
    this.chat('win');
    const bonus = 20 + this.lv.num * 8 + antsLeft;
    // Stars: how much of an army is still standing compared to the boss it beat.
    const ratio = antsLeft / Math.max(1, this.bossMax);
    const stars = ratio >= 0.6 ? 3 : ratio >= 0.25 ? 2 : 1;
    const starBonus = stars * (5 + this.lv.num * 2);
    const base = this.crumbHoney + this.fightHoney + this.foodHoney + this.bugHoney + bonus + starBonus;
    this.result = {
      win: true,
      antsLeft,
      crumbHoney: Math.round(this.crumbHoney),
      fightHoney: this.fightHoney,
      foodHoney: this.foodHoney,
      bugHoney: this.bugHoney,
      bonus,
      stars,
      starBonus,
      total: Math.round(base * st.honeyMult),
      tally: { ...this.tally },
    };
  }

  private lose() {
    this.resumePhase = this.phase === 'battle' ? 'run' : this.phase;
    this.battle = null;
    this.phase = 'lose';
    this.phaseT = 0;
    this.count = 0;
    this.sound.lose();
    this.sound.setMusic('off');
    this.slam = null;
    buzz(200);
    const base = (this.crumbHoney + this.fightHoney + this.foodHoney + this.bugHoney) * 0.5;
    this.result = {
      win: false,
      antsLeft: 0,
      crumbHoney: Math.round(this.crumbHoney * 0.5),
      fightHoney: Math.round(this.fightHoney * 0.5),
      foodHoney: Math.round(this.foodHoney * 0.5),
      bugHoney: Math.round(this.bugHoney * 0.5),
      bonus: 0,
      stars: 0,
      starBonus: 0,
      total: Math.round(base * this.stats.honeyMult),
      tally: { ...this.tally },
    };
  }

  /** How many ants a revive brings back: enough to have a real shot at the boss. */
  get reviveAnts() {
    const n = Math.max(10, Math.round(this.tally.maxAnts * 0.4));
    if (this.resumePhase !== 'boss' && this.resumePhase !== 'bossIntro') return n;
    return Math.max(n, Math.ceil((this.bossHP / this.stats.power) * 0.75));
  }

  /** Second chance after the swarm is wiped out: pick up right where it fell, with a shield. */
  revive() {
    if (this.phase !== 'lose') return;
    const n = this.reviveAnts;
    this.revives++;
    this.phase = this.resumePhase;
    this.phaseT = 0;
    this.ended = false;
    this.result = null;
    this.slam = null;
    this.slamCD = 1.5;
    this.tickAcc = 0;
    this.combo = 0;
    this.shieldT = 4;
    const boss = this.phase === 'boss';
    this.count = n;
    this.syncAnts(boss ? this.bossCx : this.x, boss ? this.bossCy : this.d);
    this.sound.revive();
    this.sound.setMusic(boss || this.phase === 'bossIntro' ? 'boss' : 'run');
    buzz([30, 30, 80]);
    this.confetti(this.x, this.d, 40);
    this.float(boss ? this.bossCx : this.x, (boss ? this.bossCy : this.d) + this.radius + 50, `💖 ${t('revived')}`, '#ff7eb6', 34);
    this.chatCD = 0;
    this.chat('good');
  }

  private updateFx(dt: number) {
    for (const p of this.parts) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'confetti') {
        p.vy -= 260 * dt;
        p.vx *= 0.98;
        p.rot += dt * 8;
      } else {
        p.vx *= 0.9;
        p.vy *= 0.9;
      }
    }
    this.parts = this.parts.filter((p) => p.life < p.max);
    if (this.parts.length > 600) this.parts.splice(0, this.parts.length - 600);
    for (const f of this.texts) {
      f.life += dt;
      f.y += 40 * dt;
    }
    this.texts = this.texts.filter((f) => f.life < 1.1);
    for (const c of this.chats) c.life += dt;
    this.chats = this.chats.filter((c) => c.life < CHAT_LIFE);
    if (this.bossLine && (this.bossLine.life += dt) > 2.2) this.bossLine = null;
  }

  // ------------------------------------------------------------ render
  render(ctx: CanvasRenderingContext2D, W: number, H: number, dpr: number) {
    const scale = (this.scale = Math.min(W / 430, H / 660));
    const baseY = H * 0.7;
    const sx = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const sy = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (W / 2 + sx), dpr * (baseY + sy));
    const cam = this.camD;
    const Y = (d: number) => -(d - cam);
    const top = -baseY / scale - 20;
    const bottom = (H - baseY) / scale + 20;
    const visTop = cam - top;
    const visBot = cam - bottom;
    const vis = (d: number, m = 80) => d < visTop + m && d > visBot - m;
    const lv = this.lv;
    const theme = THEMES[lv.themeIdx];
    const tm = this.time;

    drawGround(ctx, theme, lv.themeIdx, cam, top, bottom, W / 2 / scale + 10);

    // start ribbon
    if (vis(-10)) this.drawRibbon(ctx, Y(-10), '#7ed6ff', 'START');
    // boss arena line
    if (vis(this.stopD + 40)) this.drawRibbon(ctx, Y(this.stopD + 40), '#ff7eb6', 'BOSS');

    for (const b of lv.boosts) if (vis(b.d, 120)) drawBoostPad(ctx, b.x, Y(b.d), BOOST_W, BOOST_L, tm, b.used);
    for (const c of lv.crumbs) if (!c.taken && vis(c.d)) drawCrumb(ctx, c.kind, c.x, Y(c.d), c.seed, tm);
    for (const p of lv.powerups) if (!p.taken && vis(p.d)) drawPowerUp(ctx, p.kind, p.x, Y(p.d), p.seed, tm);

    if (this.slam) {
      const [x0, x1] = this.slamRange(this.slam.side);
      drawSlamZone(ctx, x0, x1, Y(this.bossD - 30), Y(this.stopD - 100), Math.min(1, this.slam.t / this.slam.warn), tm, this.slam.hit > 0);
    }

    for (const f of lv.foods) {
      if (!vis(f.d, 120)) continue;
      drawFood(ctx, f.kind, f.x, Y(f.d), f.r, tm, f.state === 'carried');
      if (f.state === 'carried') {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU;
          drawAnt(ctx, this.spr, f.x + Math.cos(a) * f.r * 0.9, Y(f.d) + Math.sin(a) * f.r * 0.6 + 10, Math.sign(f.x) * 1.4, ANT, Math.floor(tm * 14 + i));
        }
      } else {
        // "need N" badge
        const ok = this.count >= f.need;
        rrect(ctx, f.x - 26, Y(f.d) - f.r - 30, 52, 22, 10, f.need, 0.5);
        paint(ctx, f.state === 'nope' ? '#ffd0cc' : ok ? '#d7f7c8' : '#fff4d6', 2);
        text(ctx, `🐜${f.need}`, f.x, Y(f.d) - f.r - 19, 14, ok ? '#3fa35a' : INK, '#fff');
      }
    }

    for (const j of lv.jars) {
      if (!vis(j.d, 120) || j.anim > 0.5) continue;
      drawJar(ctx, j.x, Y(j.d), j.seed, tm, j.anim, () => {
        if (j.open) return;
        for (let i = 0; i < Math.min(5, j.n); i++) {
          // prisoners hopping and waving for help
          const a = i * GOLDEN;
          const r = 4 + i * 2.6;
          const hop = Math.abs(Math.sin(tm * 8 + i * 1.7)) * 4;
          drawAnt(ctx, this.spr, Math.cos(a) * r * 1.2, 6 + Math.sin(a) * r - hop, Math.sin(tm * 5 + i) * 0.4, 15, Math.floor(tm * 10 + i));
        }
      });
      if (!j.open) this.badge(ctx, j.x, Y(j.d) - 50, `🐜+${j.n}`, '#3fa35a', 15);
    }

    for (const s of lv.stomps) {
      if ((s.state === 'warn' || s.state === 'down') && vis(s.d, 150)) {
        const k = s.state === 'warn' ? Math.min(1, s.timer / 1.15) : 1;
        drawFootShadow(ctx, s.x, Y(s.d), 58, k);
      }
    }

    for (const b of lv.bugs) {
      if (!vis(b.d, 160) || b.state === 'caught' || (b.state === 'gone' && b.t > 1.2)) continue;
      const fly = b.state === 'gone' ? b.t / 1.2 : 0;
      ctx.globalAlpha = 1 - fly * fly;
      drawLadybug(ctx, b.x, Y(b.d), tm, b.seed, b.state === 'run', fly);
      ctx.globalAlpha = 1;
      if (b.state === 'idle') this.badge(ctx, b.x, Y(b.d) - 42, '🍯 ?', '#e0a526', 14);
    }

    for (const o of lv.obstacles) {
      if (o.smashed || !vis(o.d, 120)) continue;
      const ox = o.x + (o.move ? Math.sin(tm * o.move.speed + o.move.phase) * o.move.amp : 0);
      drawObstacle(ctx, o.kind, ox, Y(o.d), o.seed, tm, o.flip);
    }

    for (const g of lv.gates) {
      if (!vis(g.d, 60)) continue;
      const gy = Y(g.d);
      const w = TRACK_HALF;
      const look = (op: GateOp) => (op.op === '?' ? 'mystery' : gateGood(op));
      const slot = g.slot;
      const face = (side: -1 | 1) => (slot?.side === side ? slotOp(slot, tm) : side < 0 ? g.left : g.right);
      const reel = (side: -1 | 1) => (slot?.side === side ? (tm / slot.period) % 1 : -1);
      const L = face(-1);
      const R = face(1);
      if (g.chosen !== -1 || g.used < 0.6) drawGate(ctx, -w / 2, gy, w, gateLabel(L), look(L), g.chosen === -1 ? g.used : 0, tm, g.d, reel(-1));
      if (g.chosen !== 1 || g.used < 0.6) drawGate(ctx, w / 2, gy, w, gateLabel(R), look(R), g.chosen === 1 ? g.used : 0, tm, g.d + 1, reel(1));
      // centre post
      rrect(ctx, -6, gy - 30, 12, 60, 5, g.d, 0.5);
      paint(ctx, '#fff', 2.2);
    }

    for (const s of lv.squads) {
      if (s.dead || !vis(s.d, 100)) continue;
      const n = Math.min(40, Math.ceil(s.hp));
      let cx = s.x;
      let cy = s.d;
      if (this.battle === s) {
        cx = (this.x + s.x) / 2;
        cy = (this.d + s.d) / 2 + 22;
      }
      for (let i = 0; i < n; i++) {
        const r = 10 * Math.sqrt(i + 0.5);
        const a = i * GOLDEN;
        const bx = cx + Math.cos(a) * r + Math.sin(tm * 4 + i) * 1.5;
        const by = Y(cy) - Math.sin(a) * r * 0.9;
        drawBeetle(ctx, bx, by, 23, Math.floor(tm * 8 + i));
      }
      const sr = 14 + Math.sqrt(n) * 9;
      this.badge(ctx, cx, Y(cy) - sr - 16, String(Math.ceil(s.hp)), '#7a4fd6');
    }

    // swarm (gold while in fever, red while raging)
    const swarmSpr = this.feverT > 0 ? this.goldSpr : this.rageT > 0 ? this.rageSpr : this.spr;
    for (let i = this.ants.length - 1; i >= 0; i--) {
      const a = this.ants[i];
      const size = ANT * (a.pop < 1 ? 0.4 + a.pop * 0.6 + Math.sin(a.pop * Math.PI) * 0.4 : 1) * (this.feverT > 0 ? 1.1 : 1) * (this.giantT > 0 ? GIANT : 1);
      if (a.inv > 0 && this.shieldT <= 0 && Math.floor(tm * 20) % 2) continue;
      drawAnt(ctx, swarmSpr, a.x, Y(a.y), a.ang, size, Math.floor(a.ft));
    }
    if (this.phase !== 'lose' && this.count > 0) {
      const capX = this.phase === 'boss' ? this.bossCx : this.phase === 'battle' && this.battle ? (this.x + this.battle.x) / 2 : this.x;
      const capD = this.phase === 'boss' ? this.bossCy : this.phase === 'battle' && this.battle ? (this.d + this.battle.d) / 2 - 10 : this.d;
      if (this.shieldT > 0) {
        const fade = this.shieldT < 1.5 ? (Math.floor(tm * 10) % 2 ? 0.4 : 1) : 1;
        drawShield(ctx, capX, Y(capD), this.radius + 18, tm, fade);
      }
      const bounce = this.phase === 'win' ? Math.abs(Math.sin(tm * 7)) * 12 : 0;
      const capSize = ANT * 1.9 * (this.stats.captain === 'chubby' ? 1.12 : 1) * (this.giantT > 0 ? 1.3 : 1);
      drawAnt(ctx, this.capSpr, capX, Y(capD) - bounce, 0, capSize, Math.floor(tm * 12));
      drawAccessory(ctx, this.stats.captain, capX, Y(capD) - bounce, capSize, tm);
    }

    // boss
    if (vis(this.bossD, 200)) {
      drawBoss(ctx, lv.boss, 0, Y(this.bossD), tm, this.bossV);
      if (!this.bossV.dead) {
        this.badge(ctx, 0, Y(this.bossD) - 110, `❤ ${Math.max(0, Math.ceil(this.bossHP))}`, '#ef4b5f', 20);
        const bname = BOSSES.find((b) => b.kind === lv.boss)!;
        text(ctx, tr(bname.name), 0, Y(this.bossD) - 140, 16, '#fff', INK);
      }
      if (this.bossLine) {
        const l = this.bossLine.life;
        ctx.globalAlpha = Math.min(1, (2.2 - l) * 3);
        drawSpeech(ctx, this.bossLine.s, 70, Y(this.bossD) - 150, 15, Math.min(1, l * 6), '#ffe3ea');
        ctx.globalAlpha = 1;
      }
    }

    // foot on top of everything it squashes
    for (const s of lv.stomps) {
      if (!vis(s.d, 200)) continue;
      if (s.state === 'warn' && s.timer > 0.55) drawFoot(ctx, s.x, Y(s.d), 58, 1 - (s.timer - 0.55) / 0.6);
      else if (s.state === 'down') drawFoot(ctx, s.x, Y(s.d), 58, 0);
      else if (s.state === 'up') drawFoot(ctx, s.x, Y(s.d), 58, s.timer / 0.5);
    }

    // ant chatter
    for (const c of this.chats) {
      const k = c.life < 0.15 ? (c.life / 0.15) * 1.1 : 1;
      ctx.globalAlpha = Math.min(1, (CHAT_LIFE - c.life) * 4);
      drawSpeech(ctx, c.s, c.ant.x, Y(c.ant.y) - 12 * (this.giantT > 0 ? GIANT : 1), 14, k);
    }
    ctx.globalAlpha = 1;

    // particles
    for (const p of this.parts) {
      const k = 1 - p.life / p.max;
      ctx.globalAlpha = Math.min(1, k * 1.5);
      ctx.fillStyle = p.color;
      const py = Y(p.y);
      if (p.kind === 'confetti') {
        ctx.save();
        ctx.translate(p.x, py);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else if (p.kind === 'spark') {
        ctx.save();
        ctx.translate(p.x, py);
        ctx.rotate(p.rot + p.life * 6);
        const s = p.size * k;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const r = i % 2 ? s * 0.4 : s;
          const a = (i / 8) * TAU;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, py, p.size * (0.4 + k), 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    for (const f of this.texts) {
      const k = f.life / 1.1;
      ctx.globalAlpha = 1 - k * k;
      const s = f.size * (k < 0.15 ? 0.6 + (k / 0.15) * 0.6 : 1.2 - Math.min(0.2, k));
      text(ctx, f.s, f.x, Y(f.y), s, f.color, INK);
    }
    ctx.globalAlpha = 1;

    // ant count bubble
    if (this.count > 0 && this.phase !== 'win') {
      let bx = this.x;
      let bd = this.d;
      if (this.phase === 'boss') {
        bx = this.bossCx;
        bd = this.bossCy;
      } else if (this.phase === 'battle' && this.battle) {
        bx = (this.x + this.battle.x) / 2;
        bd = (this.d + this.battle.d) / 2 - 10;
      }
      this.badge(ctx, bx, Y(bd) + this.radius + 22, `🐜 ${Math.floor(this.count)}`, '#3a2d45', 18);
    }

    this.renderHud(ctx, W, H, dpr);
  }

  private drawRibbon(ctx: CanvasRenderingContext2D, y: number, color: string, label: string) {
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = i % 2 ? '#fff' : color;
      ctx.fillRect(-TRACK_HALF + i * 25, y - 6, 25, 12);
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.strokeRect(-TRACK_HALF, y - 6, TRACK_HALF * 2, 12);
    text(ctx, label, 0, y, 14, '#fff', INK);
  }

  private badge(ctx: CanvasRenderingContext2D, x: number, y: number, s: string, color: string, size = 16) {
    ctx.font = `800 ${size}px "Baloo 2", sans-serif`;
    const w = ctx.measureText(s).width + size;
    rrect(ctx, x - w / 2, y - size * 0.75, w, size * 1.5, size * 0.7, 3, 0.4);
    paint(ctx, color, 2.2);
    text(ctx, s, x, y + 1, size, '#fff', color);
  }

  private renderHud(ctx: CanvasRenderingContext2D, W: number, H: number, dpr: number) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const u = Math.max(0.8, Math.min(1.3, W / 420));
    if (this.dashT > 0) {
      // speed lines streaking past
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.dashT / 0.4) * 0.55;
      ctx.strokeStyle = '#fff';
      ctx.lineCap = 'round';
      for (let i = 0; i < 18; i++) {
        const lx = ((i * 0.618034) % 1) * W;
        const len = 50 + ((i * 0.37) % 1) * 90;
        const ly = ((i * 137.5 + this.time * 1500) % (H + 200)) - 100;
        ctx.lineWidth = 2 + (i % 3);
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx, ly + len);
        ctx.stroke();
      }
      ctx.restore();
    }
    // progress bar
    const bw = Math.min(W * 0.5, 320);
    const bx = W / 2 - bw / 2;
    const by = 22 * u;
    rrect(ctx, bx, by, bw, 14 * u, 7 * u, 77, 0.3);
    paint(ctx, 'rgba(255,255,255,0.85)', 2.4);
    const prog = Math.max(0, Math.min(1, this.d / this.stopD));
    if (prog > 0.01) {
      rrect(ctx, bx + 2, by + 2, (bw - 4) * prog, 10 * u, 5 * u, 78, 0);
      paint(ctx, '#7bd88f', 0);
    }
    drawAnt(ctx, this.spr, bx + bw * prog, by + 7 * u, Math.PI / 2, 26 * u, Math.floor(this.time * 12));
    text(ctx, '👑', bx + bw + 14 * u, by + 7 * u, 18 * u, '#fff', INK);
    // level label
    const lbl = !this.lv.daily ? `${t('level')} ${this.lv.num}` : t('daily');
    text(ctx, lbl, bx, by + 32 * u, 15 * u, '#fff', INK, 'left');
    // honey
    const honey = Math.round(this.crumbHoney + this.fightHoney + this.foodHoney + this.bugHoney);
    text(ctx, `🍯 ${honey}`, bx + bw, by + 32 * u, 15 * u, '#ffd166', INK, 'right');

    // active buffs
    const buffs: [string, number, number, string][] = [
      ['🔥', this.feverT, 5, '#ffd166'],
      ['⚡', this.dashT, DASH_TIME, '#7ed6ff'],
      ['🛡️', this.shieldT, POWER_TIME.shield, '#7ed6ff'],
      ['🧲', this.magnetT, POWER_TIME.magnet, '#ff7eb6'],
      ['💢', this.rageT, POWER_TIME.rage, '#ffb347'],
      ['🍄', this.giantT, POWER_TIME.giant, '#b5f27a'],
    ];
    let px = bx;
    for (const [icon, left, max, col] of buffs) {
      if (left <= 0) continue;
      const pw = 64 * u;
      const py = by + 50 * u;
      rrect(ctx, px, py, pw, 22 * u, 11 * u, 91, 0.3);
      paint(ctx, 'rgba(255,255,255,0.9)', 2);
      rrect(ctx, px + 24 * u, py + 7 * u, (pw - 30 * u) * (left / max), 8 * u, 4 * u, 92, 0);
      paint(ctx, col, 0);
      ctx.font = `${14 * u}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, px + 13 * u, py + 12 * u);
      px += pw + 6 * u;
    }
    // combo meter towards fever
    if (this.combo >= 3 && this.feverT <= 0 && this.phase === 'run') {
      const k = (this.combo % FEVER_COMBO) / FEVER_COMBO;
      text(ctx, `${t('combo', this.combo)}`, W / 2, H * 0.17, (16 + k * 10) * u, k > 0.66 ? '#ffd166' : '#fff', INK);
    }
    // fever frame
    if (this.feverT > 0) {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(this.time * 12) * 0.2;
      ctx.lineWidth = 14 * u;
      ctx.strokeStyle = `hsl(${(this.time * 240) % 360}, 90%, 65%)`;
      ctx.strokeRect(0, 0, W, H);
      ctx.restore();
      text(ctx, `🔥 ${t('fever')} 🔥`, W / 2, H * 0.17, 26 * u + Math.sin(this.time * 10) * 2, '#ffd166', INK);
    }

    if (this.phase === 'ready') {
      const bob = Math.sin(this.time * 4) * 8;
      ctx.globalAlpha = 0.95;
      text(ctx, t('dragHint'), W / 2, H * 0.44, 22 * u, '#fff', INK);
      text(ctx, t('keyHint'), W / 2, H * 0.44 + 28 * u, 14 * u, '#fff', INK);
      text(ctx, '👆', W / 2 + bob * 3, H * 0.52, 40 * u, '#fff', INK);
      ctx.globalAlpha = 1;
    }
    if (this.phase === 'bossIntro') {
      const k = Math.min(1, this.phaseT * 3);
      ctx.save();
      ctx.translate(W / 2, H * 0.3);
      ctx.rotate(-0.06);
      ctx.scale(k, k);
      text(ctx, t('bossTime'), 0, 0, 40 * u, '#ff7eb6', INK);
      ctx.restore();
      if (this.lv.num <= 4 || this.lv.daily) wrapText(ctx, t('tipBoss'), W / 2, H * 0.3 + 50 * u, Math.min(W - 40, 380), 16 * u);
    }
    if (this.rageBanner > 0) {
      const k = Math.min(1, (1.8 - this.rageBanner) * 4);
      ctx.save();
      ctx.translate(W / 2 + Math.sin(this.time * 50) * 2 * this.rageBanner, H * 0.25);
      ctx.rotate(0.05);
      ctx.scale(k, k);
      ctx.globalAlpha = Math.min(1, this.rageBanner * 2);
      text(ctx, `💢 ${t('bossRage')}`, 0, 0, 34 * u, '#ff5d6c', INK);
      ctx.restore();
    }
    if (this.phase === 'win') {
      const k = Math.min(1, this.phaseT * 3);
      ctx.save();
      ctx.translate(W / 2, H * 0.3);
      ctx.scale(k, k);
      ctx.rotate(Math.sin(this.time * 4) * 0.05);
      text(ctx, t('win'), 0, 0, 48 * u, '#ffd166', INK);
      ctx.restore();
    }
    if (this.phase === 'lose') {
      text(ctx, t('lose'), W / 2, H * 0.4, 30 * u, '#ff8a80', INK);
    }
  }
}

function wrapText(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, maxW: number, size: number) {
  ctx.font = `800 ${size}px "Baloo 2", sans-serif`;
  const lines: string[] = [];
  let cur = '';
  for (const w of s.split(' ')) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  lines.forEach((l, i) => text(ctx, l, x, y + i * size * 1.25, size, '#fff', INK));
}
