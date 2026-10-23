import { BOSSES, THEMES, type BossKind } from './data';
import type { CrumbKind, FoodKind, ObstacleKind } from './art';
import { TRACK_HALF } from './art';
import { irange, mulberry32, pick, range, type Rng } from './rng';

export interface Crumb { kind: CrumbKind; x: number; d: number; value: number; taken: boolean; seed: number }
export interface GateOp { op: '+' | '-' | 'x' | '/' | '?'; v: number }
export interface Gate { d: number; left: GateOp; right: GateOp; used: number; chosen: 0 | -1 | 1 }
export interface Collider { dx: number; dy: number; r: number }
export interface Obstacle {
  kind: ObstacleKind; x: number; d: number; seed: number; flip: number; colliders: Collider[];
  move?: { amp: number; speed: number; phase: number };
}
export interface Squad { x: number; d: number; hp: number; max: number; dead: boolean; reward: number }
export interface Food {
  kind: FoodKind; x: number; d: number; r: number; need: number; carriers: number; value: number;
  state: 'idle' | 'carried' | 'nope'; anim: number;
}
export type PowerKind = 'shield' | 'magnet' | 'rage';
export interface PowerUp { kind: PowerKind; x: number; d: number; taken: boolean; seed: number }
export interface Stomp { x: number; d: number; trigger: number; state: 'wait' | 'warn' | 'down' | 'up' | 'done'; timer: number }

export interface Level {
  num: number;
  daily?: boolean;
  length: number;
  themeIdx: number;
  boss: BossKind;
  bossHP: number;
  speed: number;
  crumbs: Crumb[];
  gates: Gate[];
  obstacles: Obstacle[];
  squads: Squad[];
  foods: Food[];
  stomps: Stomp[];
  powerups: PowerUp[];
}

export const gateLabel = (g: GateOp) => (g.op === '?' ? '?' : (g.op === '+' ? '+' : g.op === '-' ? '−' : g.op === 'x' ? '×' : '÷') + g.v);
export const gateGood = (g: GateOp) => g.op === '+' || g.op === 'x';
/** A mystery gate turns into a real one when the swarm walks through it: usually a treat, sometimes a trick. */
export function revealMystery(n: number, rnd: () => number): GateOp {
  const k = rnd();
  if (k < 0.3) return { op: 'x', v: k < 0.06 ? 3 : 2 };
  if (k < 0.68) return { op: '+', v: Math.max(5, Math.round(n * (0.3 + rnd() * 0.5))) };
  if (k < 0.85) return { op: '-', v: Math.max(2, Math.round(n * 0.3)) };
  return { op: '/', v: 2 };
}
export function applyGate(n: number, g: GateOp, plusBoost = 1) {
  switch (g.op) {
    case '?': return n;
    case '+': return n + Math.round(g.v * plusBoost);
    case '-': return n - g.v;
    case 'x': return n * g.v;
    case '/': return Math.ceil(n / g.v);
  }
}

const H = TRACK_HALF;

/**
 * Builds a level. The generator keeps a rough estimate of how big a
 * reasonable player's swarm is, and sizes enemies and the boss against it,
 * so levels stay beatable without becoming trivial.
 */
export function generateLevel(num: number, seed: number, themeOverride?: number): Level {
  const r = mulberry32(seed);
  const segLen = 330;
  const length = 2300 + Math.min(num, 30) * 110;
  const lv: Level = {
    num,
    length,
    themeIdx: themeOverride ?? (num - 1) % THEMES.length,
    boss: BOSSES[(num - 1) % BOSSES.length].kind,
    bossHP: 0,
    speed: 150 + Math.min(num, 25) * 3,
    crumbs: [], gates: [], obstacles: [], squads: [], foods: [], stomps: [], powerups: [],
  };
  let est = 10 + Math.min(num, 40) * 0.7;
  let d = 380;
  let lastType = '';
  let seedN = 1;
  let mysteryLeft = num >= 2 ? 1 : 0; // guarantee one ❓ gate per level from level 2

  const crumbLine = (x0: number, x1: number, d0: number, n: number, shape: 'line' | 'zig' | 'arc') => {
    for (let i = 0; i < n; i++) {
      const k = n === 1 ? 0 : i / (n - 1);
      let x = x0 + (x1 - x0) * k;
      if (shape === 'zig') x += Math.sin(k * Math.PI * 3) * 50;
      if (shape === 'arc') x += Math.sin(k * Math.PI) * 60;
      const roll = r();
      const kind: CrumbKind = roll < 0.06 ? 'candy' : roll < 0.25 ? 'sugar' : 'bread';
      const value = kind === 'candy' ? 5 : kind === 'sugar' ? 2 : 1;
      lv.crumbs.push({ kind, x: clampX(x, 12), d: d0 + i * 22, value, taken: false, seed: seedN++ });
      est += value * 0.75;
    }
  };

  const types: [string, number, number][] = [
    // [type, weight, min level]
    ['crumbs', 3, 1], ['gate', 4, 1], ['obstacle', 2, 1], ['squad', 2, 2],
    ['food', 1.2, 1], ['stomp', 1.2, 3], ['pea', 1, 2],
  ];

  while (d < length - 450) {
    let type = weightedPick(r, types.filter((t) => num >= t[2]));
    if (type === lastType && type !== 'crumbs') type = 'crumbs';
    if (d < 900) type = d < 600 ? 'crumbs' : 'gate'; // gentle opening: always grow first
    lastType = type;
    switch (type) {
      case 'crumbs': {
        const x0 = range(r, -H + 30, H - 30);
        crumbLine(x0, clampX(x0 + range(r, -120, 120), 30), d, irange(r, 8, 14), pick(r, ['line', 'zig', 'arc'] as const));
        break;
      }
      case 'gate': {
        const g = makeGate(r, num, est, d < 900, mysteryLeft > 0);
        if (g[0].op === '?' || g[1].op === '?') mysteryLeft--;
        lv.gates.push({ d: d + 120, left: g[0], right: g[1], used: 0, chosen: 0 });
        const best = Math.max(applyGate(est, g[0]), applyGate(est, g[1]));
        est = Math.max(6, best * 0.85);
        crumbLine(range(r, -H + 30, H - 30), range(r, -H + 30, H - 30), d - 20, irange(r, 3, 5), 'line');
        break;
      }
      case 'obstacle': {
        const n = irange(r, 1, num < 4 ? 2 : 3);
        for (let i = 0; i < n; i++) {
          lv.obstacles.push(makeObstacle(r, pick(r, ['spoon', 'eraser', 'peel', 'tack', 'button'] as const), range(r, -H + 50, H - 50), d + 60 + i * 95, seedN++));
        }
        // tempting crumbs right next to the danger
        crumbLine(range(r, -H + 30, H - 30), range(r, -H + 30, H - 30), d, irange(r, 6, 10), 'zig');
        est *= 0.93;
        break;
      }
      case 'pea': {
        const n = irange(r, 1, 2);
        for (let i = 0; i < n; i++) {
          const o = makeObstacle(r, 'pea', 0, d + 80 + i * 110, seedN++);
          o.move = { amp: range(r, 110, 160), speed: range(r, 1.4, 2.2 + num * 0.03), phase: range(r, 0, 6) };
          lv.obstacles.push(o);
        }
        crumbLine(0, 0, d + 40, irange(r, 6, 9), 'line');
        est *= 0.94;
        break;
      }
      case 'squad': {
        const two = r() < 0.45;
        const hpA = Math.max(3, Math.round(est * range(r, 0.22, 0.42)));
        if (two) {
          // two squads side by side: pick the weaker fight (or squeeze between!)
          const hpB = Math.max(3, Math.round(hpA * range(r, 1.6, 2.4)));
          const swap = r() < 0.5;
          lv.squads.push({ x: -95, d: d + 120, hp: swap ? hpA : hpB, max: swap ? hpA : hpB, dead: false, reward: (swap ? hpA : hpB) * 2 });
          lv.squads.push({ x: 95, d: d + 120, hp: swap ? hpB : hpA, max: swap ? hpB : hpA, dead: false, reward: (swap ? hpB : hpA) * 2 });
        } else {
          lv.squads.push({ x: range(r, -100, 100), d: d + 120, hp: hpA, max: hpA, dead: false, reward: hpA * 2 });
        }
        est = Math.max(5, est - hpA * 0.8);
        crumbLine(range(r, -H + 30, H - 30), range(r, -H + 30, H - 30), d + 200, irange(r, 4, 7), 'arc');
        break;
      }
      case 'food': {
        const side = r() < 0.5 ? -1 : 1;
        const need = Math.max(8, Math.round(est * range(r, 0.6, 1.05)));
        const carriers = Math.ceil(need * 0.25);
        lv.foods.push({
          kind: pick(r, ['melon', 'donut', 'cookie', 'cheese'] as const),
          x: side * 115, d: d + 130, r: 34, need, carriers, value: need * 2 + 15, state: 'idle', anim: 0,
        });
        crumbLine(-side * 100, -side * 100, d + 40, irange(r, 5, 8), 'line');
        break;
      }
      case 'stomp': {
        lv.stomps.push({ x: 0, d: d + 160, trigger: d + 160, state: 'wait', timer: 0 });
        crumbLine(range(r, -H + 30, H - 30), range(r, -H + 30, H - 30), d, irange(r, 8, 12), 'zig');
        est *= 0.92;
        break;
      }
    }
    // Every few segments a power-up bubble floats somewhere on the track.
    if (d > 1000 && r() < 0.35) {
      const kinds: PowerKind[] = num >= 2 ? ['shield', 'magnet', 'rage'] : ['magnet', 'shield'];
      lv.powerups.push({ kind: pick(r, kinds), x: range(r, -H + 50, H - 50), d: d + segLen - 40, taken: false, seed: seedN++ });
    }
    d += segLen + range(r, -30, 40);
  }
  // Always at least one power-up per level, around the middle.
  if (!lv.powerups.length) {
    lv.powerups.push({ kind: num < 2 ? 'magnet' : pick(r, ['shield', 'magnet', 'rage'] as const), x: range(r, -H + 50, H - 50), d: length * 0.5, taken: false, seed: seedN++ });
  }
  // Boss is tuned so a decent run wins and a sloppy one doesn't.
  const ratio = num <= 2 ? 0.55 : Math.min(1.3, 0.75 + num * 0.035);
  lv.bossHP = Math.max(12, Math.round(est * ratio * range(r, 0.9, 1.1)));
  return lv;
}

function makeGate(r: Rng, num: number, est: number, safe: boolean, wantMystery: boolean): [GateOp, GateOp] {
  const plus = (): GateOp => ({ op: '+', v: irange(r, 4, 8 + Math.round(num * 1.5 + est * 0.25)) });
  // Bad gates hurt but never wipe out an average swarm on their own.
  const minus = (): GateOp => ({ op: '-', v: irange(r, 3, Math.max(4, Math.round(est * 0.55))) });
  const good = (): GateOp => {
    const k = r();
    if (k < 0.22) return { op: 'x', v: num >= 5 && r() < 0.2 ? 3 : 2 };
    return plus();
  };
  const bad = (): GateOp => (r() < 0.3 ? { op: '/', v: 2 } : minus());
  const k = r();
  let pair: [GateOp, GateOp];
  if (safe) pair = [good(), good()];
  else if (num >= 2 && (wantMystery || k < 0.25)) pair = [{ op: '?', v: 0 }, r() < 0.5 ? good() : bad()];
  else if (k < 0.55) pair = [good(), bad()];
  else if (k < 0.9) pair = [good(), good()];
  else pair = [bad(), bad()];
  return r() < 0.5 ? pair : [pair[1], pair[0]];
}

function makeObstacle(r: Rng, kind: ObstacleKind, x: number, d: number, seed: number): Obstacle {
  const flip = r() < 0.5 ? -1 : 1;
  let colliders: Collider[] = [];
  switch (kind) {
    case 'spoon':
      colliders = [{ dx: -34 * flip, dy: -2, r: 27 }];
      for (let i = 0; i < 6; i++) colliders.push({ dx: (8 + i * 15) * flip, dy: -3, r: 8 });
      break;
    case 'eraser':
      for (let i = -1.5; i <= 1.5; i++) colliders.push({ dx: i * 20, dy: -3 + i * 3 * flip, r: 17 });
      break;
    case 'peel': colliders = [{ dx: 0, dy: 0, r: 30 }]; break;
    case 'tack': colliders = [{ dx: 0, dy: 0, r: 18 }]; break;
    case 'button': colliders = [{ dx: 0, dy: 0, r: 24 }]; break;
    case 'pea': colliders = [{ dx: 0, dy: 0, r: 17 }]; break;
  }
  return { kind, x: kind === 'spoon' ? clampX(x, 60) : x, d, seed, flip, colliders };
}

function weightedPick(r: Rng, items: [string, number, number][]) {
  const total = items.reduce((s, i) => s + i[1], 0);
  let k = r() * total;
  for (const it of items) {
    k -= it[1];
    if (k <= 0) return it[0];
  }
  return items[0][0];
}

const clampX = (x: number, m: number) => Math.max(-H + m, Math.min(H - m, x));
