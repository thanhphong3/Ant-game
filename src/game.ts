import {
  INK, TAU, TRACK_HALF, drawAccessory, drawAnt, drawBeetle, drawBoss, drawCrumb, drawFood, drawFoot,
  drawFootShadow, drawGate, drawGround, drawObstacle, drawPowerUp, drawShield, drawSlamZone, makeAntSprites, paint,
  rrect, setBoil, text,
  type AntSprites, type BossVisual,
} from './art';
import type { Sound } from './audio';
import { BOSSES, THEMES, type CaptainId } from './data';
import { t, tr } from './i18n';
import { applyGate, gateGood, gateLabel, revealMystery, type Level, type Squad } from './level';

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

export interface RunResult {
  win: boolean;
  antsLeft: number;
  crumbHoney: number;
  fightHoney: number;
  foodHoney: number;
  bonus: number;
  stars: number;
  starBonus: number;
  total: number;
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

type Phase = 'ready' | 'run' | 'battle' | 'bossIntro' | 'boss' | 'win' | 'lose';

const VMAX = 220;
const SPACING = 9.5;
const ANT = 18;
const GOLDEN = 2.39996;
const SMOKE = '#e3d9ee';
const FEVER_COMBO = 10;
const POWER_TIME = { shield: 6, magnet: 7, rage: 8 } as const;
const SLAM_WARN = 1.0;

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
  bossHP: number;
  bossMax: number;
  bossV: BossVisual = { hurt: 0, attack: 0, dead: false };
  private lastHurt = 0;
  // timed buffs (seconds left)
  shieldT = 0;
  magnetT = 0;
  rageT = 0;
  feverT = 0;
  // boss slam: side of the arena about to be smashed, and its countdown
  slam: { side: -1 | 1; t: number; hit: number } | null = null;
  slamCD = 0.6;
  slamCount = 0;
  battle: Squad | null = null;
  tickAcc = 0;
  ended = false;
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
    return this.stats.power * (this.rageT > 0 ? 2 : 1);
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
    const lim = TRACK_HALF - size * 2.5;
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
    if (this.phase === 'run') speed = lv.speed;
    if (this.phase === 'bossIntro') speed = this.d < this.stopD ? lv.speed : 0;
    this.d = Math.min(this.d + speed * dt, this.phase === 'run' || this.phase === 'bossIntro' ? this.stopD : this.d);
    if (this.phase !== 'win') this.x += (this.targetX - this.x) * Math.min(1, dt * 9);

    this.comboT -= dt;
    if (this.comboT <= 0) this.combo = 0;
    this.shieldT = Math.max(0, this.shieldT - dt);
    this.magnetT = Math.max(0, this.magnetT - dt);
    this.rageT = Math.max(0, this.rageT - dt);
    this.feverT = Math.max(0, this.feverT - dt);
    if (this.feverT > 0 && Math.random() < dt * 10) this.sparkle(this.x + (Math.random() - 0.5) * this.radius * 2, this.d + (Math.random() - 0.5) * this.radius * 2, '#ffd166', 1);

    if (this.phase === 'run') {
      this.updatePickups();
      this.updateGates(dt);
      this.updateHazards(dt);
      this.updateSquadContact();
      this.updateFoods();
      if (this.d >= lv.length - 380) {
        this.phase = 'bossIntro';
        this.phaseT = 0;
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
      }
    } else if (this.phase === 'boss') {
      this.updateBoss(dt);
    } else if (this.phase === 'win' || this.phase === 'lose') {
      if (this.phaseT > 2.4 && !this.ended) {
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
    const R = this.radius + 8 + this.stats.magnet + (this.magnetT > 0 ? 110 : 0) + (fever ? 25 : 0);
    const PR = this.radius + 22;
    for (const p of this.lv.powerups) {
      if (p.taken || Math.abs(p.d - this.d) > PR + 10) continue;
      const dx = p.x - this.x;
      const dy = p.d - this.d;
      if (dx * dx + dy * dy > PR * PR) continue;
      p.taken = true;
      if (p.kind === 'shield') this.shieldT = POWER_TIME.shield;
      else if (p.kind === 'magnet') this.magnetT = POWER_TIME.magnet;
      else this.rageT = POWER_TIME.rage;
      this.sound.power();
      buzz(30);
      this.sparkle(p.x, p.d, p.kind === 'shield' ? '#7ed6ff' : p.kind === 'magnet' ? '#ff7eb6' : '#ffb347', 18);
      this.float(this.x, this.d + this.radius + 50, t(p.kind), '#fff', 24);
    }
    for (const c of this.lv.crumbs) {
      if (c.taken || c.d < this.d - R - 30 || c.d > this.d + R + 30) continue;
      const dx = c.x - this.x;
      const dy = c.d - this.d;
      if (dx * dx + dy * dy < R * R) {
        c.taken = true;
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
          this.sound.fever();
          buzz([20, 40, 20]);
          this.confetti(this.x, this.d, 30);
          this.float(this.x, this.d + this.radius + 60, t('fever'), '#ffd166', 38);
        } else if (this.combo === 5) {
          this.float(this.x, this.d + this.radius + 40, t('combo', this.combo), '#ff7eb6', 26);
        }
      }
    }
  }

  private updateGates(dt: number) {
    for (const g of this.lv.gates) {
      if (g.chosen) {
        g.used += dt;
        continue;
      }
      if (this.d < g.d) continue;
      g.chosen = this.x < 0 ? -1 : 1;
      g.used = 0.001;
      let op = g.chosen < 0 ? g.left : g.right;
      const before = this.count;
      const mystery = op.op === '?';
      if (mystery) {
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
      } else {
        this.sound.gateBad();
        this.shake = 6;
        buzz(60);
      }
    }
  }

  private updateHazards(dt: number) {
    const st = this.stats;
    // obstacles
    for (const o of this.lv.obstacles) {
      if (Math.abs(o.d - this.d) > 260) continue;
      const ox = o.x + (o.move ? Math.sin(this.time * o.move.speed + o.move.phase) * o.move.amp : 0);
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
          if (shielded || Math.random() < st.dodge) {
            const l = Math.sqrt(d2) || 1;
            a.x = cx + (dx / l) * (c.r + 6);
            a.y = cy + (dy / l) * (c.r + 6);
            a.inv = 0.5;
            if (shielded) {
              if (Math.random() < 0.15) {
                this.float(a.x, a.y + 10, t('blocked'), '#7ed6ff', 14);
                this.sound.block();
              }
            } else if (Math.random() < 0.25) this.float(a.x, a.y + 10, t('dodge'), '#7ed6ff', 14);
          } else {
            this.killAnt(i);
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
        if (this.shieldT > 0) {
          this.float(s.x, s.d + 40, t('blocked'), '#7ed6ff', 22);
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
        this.addCount(-f.carriers, f.x, f.d);
        this.foodHoney += f.value;
        this.sound.carry();
        this.float(f.x, f.d + 50, t('carried', f.value), '#ffd166', 18);
        this.sparkle(f.x, f.d, '#ffd166', 16);
      } else {
        f.state = 'nope';
        this.sound.nope();
        this.float(f.x, f.d + 50, t('needAnts', f.need), '#ff8a80', 18);
      }
    }
  }

  private updateBoss(dt: number) {
    // Slower than a squad fight so there is time to dodge the boss's slams.
    const rate = Math.max(8, (this.count + this.bossHP) / 7);
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
    if (this.bossHP <= 0 && this.count > 0) this.win();
  }

  /** Arena x-range a slam on `side` covers; the middle strip stays safe. */
  slamRange(side: -1 | 1): [number, number] {
    return side < 0 ? [-TRACK_HALF, -22] : [22, TRACK_HALF];
  }

  private updateSlam(dt: number) {
    if (this.slam) {
      const sl = this.slam;
      if (sl.hit > 0) {
        sl.hit -= dt;
        if (sl.hit <= 0) this.slam = null;
        return;
      }
      sl.t += dt;
      if (sl.t < SLAM_WARN) return;
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
      if (frac === 0 || this.shieldT > 0) {
        const dmg = Math.max(2, Math.round(this.bossMax * 0.07 * (this.rageT > 0 ? 1.5 : 1)));
        this.bossHP -= dmg;
        this.bossV.hurt = 1;
        this.sound.counter();
        this.float(0, this.bossD - 60, `${t('counter')} -${dmg}`, '#ffd166', 30);
        this.sparkle(0, this.bossD - 40, '#ffd166', 20);
      } else {
        const lost = Math.max(1, Math.round(this.count * frac * 0.22 * (1 - this.stats.dodge * 0.5)));
        for (const a of this.ants) if (a.x > x0 && a.x < x1 && Math.random() < 0.5) this.poof(a.x, a.y, SMOKE, 2);
        this.addCount(-lost, this.bossCx, this.bossCy);
        this.float((x0 + x1) / 2, this.bossCy + 40, `${t('ouch')} -${lost}`, '#ff8a80', 24);
      }
      this.slamCD = 0.7 + Math.random() * 0.5;
      return;
    }
    this.slamCD -= dt;
    if (this.slamCD > 0) return;
    // Aim at the side holding most of the swarm, so the player has to move.
    const side: -1 | 1 = Math.abs(this.bossCx) < 12 ? (Math.random() < 0.5 ? -1 : 1) : this.bossCx < 0 ? -1 : 1;
    this.slam = { side, t: 0, hit: 0 };
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
    const bonus = 20 + this.lv.num * 8 + antsLeft;
    // Stars: how much of an army is still standing compared to the boss it beat.
    const ratio = antsLeft / Math.max(1, this.bossMax);
    const stars = ratio >= 0.6 ? 3 : ratio >= 0.25 ? 2 : 1;
    const starBonus = stars * (5 + this.lv.num * 2);
    const base = this.crumbHoney + this.fightHoney + this.foodHoney + bonus + starBonus;
    this.result = {
      win: true,
      antsLeft,
      crumbHoney: Math.round(this.crumbHoney),
      fightHoney: this.fightHoney,
      foodHoney: this.foodHoney,
      bonus,
      stars,
      starBonus,
      total: Math.round(base * st.honeyMult),
    };
  }

  private lose() {
    this.phase = 'lose';
    this.phaseT = 0;
    this.count = 0;
    this.sound.lose();
    this.sound.setMusic('off');
    this.slam = null;
    buzz(200);
    const base = (this.crumbHoney + this.fightHoney + this.foodHoney) * 0.5;
    this.result = {
      win: false,
      antsLeft: 0,
      crumbHoney: Math.round(this.crumbHoney * 0.5),
      fightHoney: Math.round(this.fightHoney * 0.5),
      foodHoney: Math.round(this.foodHoney * 0.5),
      bonus: 0,
      stars: 0,
      starBonus: 0,
      total: Math.round(base * this.stats.honeyMult),
    };
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

    for (const c of lv.crumbs) if (!c.taken && vis(c.d)) drawCrumb(ctx, c.kind, c.x, Y(c.d), c.seed, tm);
    for (const p of lv.powerups) if (!p.taken && vis(p.d)) drawPowerUp(ctx, p.kind, p.x, Y(p.d), p.seed, tm);

    if (this.slam) {
      const [x0, x1] = this.slamRange(this.slam.side);
      drawSlamZone(ctx, x0, x1, Y(this.bossD - 30), Y(this.stopD - 100), Math.min(1, this.slam.t / SLAM_WARN), tm, this.slam.hit > 0);
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

    for (const s of lv.stomps) {
      if ((s.state === 'warn' || s.state === 'down') && vis(s.d, 150)) {
        const k = s.state === 'warn' ? Math.min(1, s.timer / 1.15) : 1;
        drawFootShadow(ctx, s.x, Y(s.d), 58, k);
      }
    }

    for (const o of lv.obstacles) {
      if (!vis(o.d, 120)) continue;
      const ox = o.x + (o.move ? Math.sin(tm * o.move.speed + o.move.phase) * o.move.amp : 0);
      drawObstacle(ctx, o.kind, ox, Y(o.d), o.seed, tm, o.flip);
    }

    for (const g of lv.gates) {
      if (!vis(g.d, 60)) continue;
      const gy = Y(g.d);
      const w = TRACK_HALF;
      const look = (op: typeof g.left) => (op.op === '?' ? 'mystery' : gateGood(op));
      if (g.chosen !== -1 || g.used < 0.6) drawGate(ctx, -w / 2, gy, w, gateLabel(g.left), look(g.left), g.chosen === -1 ? g.used : 0, tm, g.d);
      if (g.chosen !== 1 || g.used < 0.6) drawGate(ctx, w / 2, gy, w, gateLabel(g.right), look(g.right), g.chosen === 1 ? g.used : 0, tm, g.d + 1);
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
      const size = ANT * (a.pop < 1 ? 0.4 + a.pop * 0.6 + Math.sin(a.pop * Math.PI) * 0.4 : 1) * (this.feverT > 0 ? 1.1 : 1);
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
      const capSize = ANT * 1.9 * (this.stats.captain === 'chubby' ? 1.12 : 1);
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
    }

    // foot on top of everything it squashes
    for (const s of lv.stomps) {
      if (!vis(s.d, 200)) continue;
      if (s.state === 'warn' && s.timer > 0.55) drawFoot(ctx, s.x, Y(s.d), 58, 1 - (s.timer - 0.55) / 0.6);
      else if (s.state === 'down') drawFoot(ctx, s.x, Y(s.d), 58, 0);
      else if (s.state === 'up') drawFoot(ctx, s.x, Y(s.d), 58, s.timer / 0.5);
    }

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
    const honey = Math.round(this.crumbHoney + this.fightHoney + this.foodHoney);
    text(ctx, `🍯 ${honey}`, bx + bw, by + 32 * u, 15 * u, '#ffd166', INK, 'right');

    // active buffs
    const buffs: [string, number, number, string][] = [
      ['🔥', this.feverT, 5, '#ffd166'],
      ['🛡️', this.shieldT, POWER_TIME.shield, '#7ed6ff'],
      ['🧲', this.magnetT, POWER_TIME.magnet, '#ff7eb6'],
      ['💢', this.rageT, POWER_TIME.rage, '#ffb347'],
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
