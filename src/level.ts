import { BOSSES, THEMES, type BossKind } from './data';
import type { CrumbKind, FoodKind, ObstacleKind } from './art';
import { TRACK_HALF } from './art';
import { irange, mulberry32, pick, range, type Rng } from './rng';

export interface Crumb { kind: CrumbKind; x: number; d: number; value: number; taken: boolean; seed: number }
export interface GateOp { op: '+' | '-' | 'x' | '/' | '?'; v: number }
export interface Gate {
  d: number; left: GateOp; right: GateOp; used: number; chosen: 0 | -1 | 1;
  /** Slot gate: one side keeps flipping through `ops`; whatever shows when the swarm walks in sticks. */
  slot?: { side: -1 | 1; ops: GateOp[]; period: number };
}
export interface Collider { dx: number; dy: number; r: number }
export interface Obstacle {
  kind: ObstacleKind; x: number; d: number; seed: number; flip: number; colliders: Collider[];
  /** Flattened by giant ants: harmless and gone. */
  smashed?: boolean;
  move?: { amp: number; speed: number; phase: number };
}
export interface Squad { x: number; d: number; hp: number; max: number; dead: boolean; reward: number }
export interface Food {
  kind: FoodKind; x: number; d: number; r: number; need: number; carriers: number; value: number;
  state: 'idle' | 'carried' | 'nope'; anim: number;
}
export type PowerKind = 'shield' | 'magnet' | 'rage' | 'giant';
export interface PowerUp { kind: PowerKind; x: number; d: number; taken: boolean; seed: number }
/** A glass jar of trapped ants: touch it to free them. */
export interface Jar { x: number; d: number; n: number; open: boolean; anim: number; seed: number }
/** Arrow pad on the floor: running over it starts a short invincible dash. */
export interface Boost { x: number; d: number; used: boolean }
/** Golden ladybug: bolts away once the swarm gets close and drops sweets while it runs. Catch it for a jackpot! */
export interface GoldBug {
  x: number; d: number; state: 'idle' | 'run' | 'caught' | 'gone'; t: number; vx: number;
  /** seconds until the next sweet falls out of its pockets */
  drop: number;
  /** while > 0 it is darting across the swarm in direction `vx` */
  juke: number;
  seed: number;
}
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
  jars: Jar[];
  boosts: Boost[];
  bugs: GoldBug[];
}

export const BOOST_W = 76;
export const BOOST_L = 84;
export type Slot = NonNullable<Gate['slot']>;
export const slotOp = (s: Slot, time: number) => s.ops[Math.floor(time / s.period) % s.ops.length];

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
    crumbs: [], gates: [], obstacles: [], squads: [], foods: [], stomps: [], powerups: [], jars: [], boosts: [], bugs: [],
  };
  let est = 8 + Math.min(num, 30) * 1.1;
  let d = 380;
  let lastType = '';
  let seedN = 1;
  let mysteryLeft = num >= 2 ? 1 : 0; // aim for one ❓ gate per level from level 2
  let bugLeft = 1; // one golden ladybug to chase per level
  let mushroomLeft = num >= 3 ? 1 : 0; // a 🍄 right before some hazards, so giants get to smash things
  // Every level from 2 on also features one of the newer set pieces, in rotation.
  let feature: '' | 'slot' | 'jar' | 'boost' = num < 2 ? '' : num === 2 ? 'jar' : (['slot', 'jar', 'boost'] as const)[num % 3];

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
      est += value * 1.4; // fever doubles them and magnets pull in strays
    }
  };

  const types: [string, number, number][] = [
    // [type, weight, min level]
    ['crumbs', 3, 1], ['gate', 4, 1], ['obstacle', 2, 1], ['squad', 2, 2],
    ['food', 1.2, 1], ['stomp', 1.2, 3], ['pea', 1, 2], ['jar', 1, 2], ['boost', 0.9, 3],
    ['bug', 0.8, 1],
  ];

  while (d < length - 450) {
    let type = weightedPick(r, types.filter((t) => num >= t[2]));
    if (type === lastType && type !== 'crumbs') type = 'crumbs';
    if (type === 'bug' && !bugLeft) type = 'crumbs';
    if (bugLeft && d >= length * 0.45) type = 'bug'; // make sure every level gets its chase
    if (feature && d >= 1000) type = feature === 'slot' ? 'gate' : feature;
    if (d < 900) type = d < 600 ? 'crumbs' : 'gate'; // gentle opening: always grow first
    if (type === feature) feature = '';
    if (type === 'bug') bugLeft = 0;
    lastType = type;
    switch (type) {
      case 'crumbs': {
        const x0 = range(r, -H + 30, H - 30);
        crumbLine(x0, clampX(x0 + range(r, -120, 120), 30), d, irange(r, 8, 14), pick(r, ['line', 'zig', 'arc'] as const));
        break;
      }
      case 'gate': {
        const wantSlot = num >= 3 && d >= 900 && (feature === 'slot' || r() < 0.25);
        const g = makeGate(r, num, est, d < 900, mysteryLeft > 0 && !wantSlot, wantSlot);
        if (g[0].op === '?' || g[1].op === '?') mysteryLeft--;
        const gate: Gate = { d: d + 120, left: g[0], right: g[1], used: 0, chosen: 0 };
        // a mystery gate pays about +40% on average
        const worth = (op: GateOp) => (op.op === '?' ? est * 1.3 : applyGate(est, op));
        let best = Math.max(worth(g[0]), worth(g[1]));
        if (wantSlot) {
          if (feature === 'slot') feature = '';
          // Slot gate: timing the walk-in turns a gamble into skill.
          const side: -1 | 1 = r() < 0.5 ? -1 : 1;
          const ops = makeSlot(r, num, est);
          gate.slot = { side, ops, period: num < 8 ? 0.6 : 0.5 };
          if (side < 0) gate.left = ops[0];
          else gate.right = ops[0];
          // nobody times every reel: count on half the best face, half a blind walk-in
          const blind = ops.reduce((s, o) => s + applyGate(est, o), 0) / ops.length;
          best = Math.max(worth(side < 0 ? g[1] : g[0]), (Math.max(...ops.map((o) => applyGate(est, o))) + blind) / 2);
        }
        lv.gates.push(gate);
        est = Math.max(6, best * 0.95);
        crumbLine(range(r, -H + 30, H - 30), range(r, -H + 30, H - 30), d - 20, irange(r, 3, 5), 'line');
        break;
      }
      case 'obstacle': {
        const n = irange(r, 1, num < 4 ? 2 : 3);
        if (mushroomLeft && r() < 0.5) {
          mushroomLeft = 0;
          lv.powerups.push({ kind: 'giant', x: range(r, -H + 50, H - 50), d: d - 10, taken: false, seed: seedN++ });
        }
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
      case 'jar': {
        // Trapped ants on one side, guarded by a hazard you have to weave around.
        const side = r() < 0.5 ? -1 : 1;
        const n = Math.max(5, Math.round(est * range(r, 0.3, 0.5)));
        const jx = side * range(r, 95, 140);
        lv.jars.push({ x: jx, d: d + 190, n, open: false, anim: 0, seed: seedN++ });
        lv.obstacles.push(makeObstacle(r, pick(r, ['tack', 'button', 'peel'] as const), jx - side * range(r, 0, 40), d + 70, seedN++));
        crumbLine(-side * 100, -side * 60, d, irange(r, 5, 8), 'line');
        est += n * 0.8;
        break;
      }
      case 'boost': {
        const bx = range(r, -H + 70, H - 70);
        lv.boosts.push({ x: bx, d: d + 30, used: false });
        // a long trail the dash hoovers up
        crumbLine(bx, clampX(bx + range(r, -60, 60), 30), d + 150, irange(r, 10, 14), 'zig');
        est += 6;
        break;
      }
      case 'bug': {
        lv.bugs.push({ x: range(r, -H + 60, H - 60), d: d + 170, state: 'idle', t: 0, vx: 0, drop: 0, juke: 0, seed: seedN++ });
        crumbLine(range(r, -H + 30, H - 30), range(r, -H + 30, H - 30), d, irange(r, 4, 6), 'arc');
        est += 22; // the sweets it drops during the chase add up
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
    // (none right before the boss: that fight is about the swarm you built)
    if (d > 1000 && d + segLen < length - 560 && r() < 0.35) {
      const kinds: PowerKind[] = num >= 3 ? ['shield', 'magnet', 'rage', 'giant'] : num >= 2 ? ['shield', 'magnet', 'rage'] : ['magnet', 'shield'];
      lv.powerups.push({ kind: pick(r, kinds), x: range(r, -H + 50, H - 50), d: d + segLen - 40, taken: false, seed: seedN++ });
    }
    d += segLen + range(r, -30, 40);
  }
  // Always at least one power-up per level, around the middle.
  if (!lv.powerups.length) {
    lv.powerups.push({ kind: num < 2 ? 'magnet' : pick(r, ['shield', 'magnet', 'rage'] as const), x: range(r, -H + 50, H - 50), d: length * 0.5, taken: false, seed: seedN++ });
  }
  lv.bossHP = Math.max(12, Math.round(est * bossRatio(num) * range(r, 0.9, 1.1)));
  return lv;
}

/**
 * Boss HP per point of estimated swarm. `q` is the share of a decent run's
 * punch the boss soaks up: gentle first levels, then a steady climb, with a
 * tougher boss every 5th level. The estimate trails the real swarm (fever,
 * magnets, lucky gates), hence the 1.8, and the boss also keeps pace with the
 * fighting power of a player who keeps upgrading.
 */
export const isHardLevel = (num: number) => num % 5 === 0;
export function bossRatio(num: number) {
  const q = num <= 3 ? [0, 0.3, 0.45, 0.55][num] : Math.min(0.95, 0.6 + (num - 4) * 0.02);
  return q * 1.8 * (isHardLevel(num) ? 1.12 : 1) * (1 + Math.min(num, 30) * 0.05);
}

function makeGate(r: Rng, num: number, est: number, safe: boolean, wantMystery: boolean, noMystery = false): [GateOp, GateOp] {
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
  else if (num >= 2 && !noMystery && (wantMystery || k < 0.25)) pair = [{ op: '?', v: 0 }, r() < 0.5 ? good() : bad()];
  else if (k < 0.55) pair = [good(), bad()];
  else if (k < 0.9) pair = [good(), good()];
  else pair = [bad(), bad()];
  return r() < 0.5 ? pair : [pair[1], pair[0]];
}

function makeSlot(r: Rng, num: number, est: number): GateOp[] {
  // Alternate treats and tricks so a careless walk-in is a coin flip.
  const big = Math.max(6, Math.round(est * range(r, 0.4, 0.7)));
  return [
    { op: 'x', v: num >= 10 && r() < 0.3 ? 3 : 2 },
    { op: '-', v: Math.max(4, Math.round(est * 0.45)) },
    { op: '+', v: big },
    { op: '/', v: 2 },
  ];
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
