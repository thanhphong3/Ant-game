// Balance bot. Runs inside the browser page (served by the Vite dev server) and plays the
// real game code headlessly: no rendering, a fixed 60 fps step, a muted sound stub.
import { Run } from '/src/game.ts';
import { CAPTAINS, UPGRADES, upgradeCost, upgradeStats } from '/src/data.ts';
import { applyGate, generateLevel, mercyHP, slotOp } from '/src/level.ts';
import { TRACK_HALF as H } from '/src/art.ts';
import { hashString } from '/src/rng.ts';

/** How a player plays: reaction delay (s), chance to pick the worse gate, hand wobble (px), chance to read a slot reel. */
export const SKILLS = {
  good: { react: 0.3, gateErr: 0.1, noise: 20, slotSkill: 0.4 },
  casual: { react: 0.5, gateErr: 0.25, noise: 45, slotSkill: 0 },
};

const sound = new Proxy({}, { get: () => () => {} });

/** Where a player with `skill` would steer right now. */
function choose(run, skill, rng) {
  const lv = run.lv;
  const lim = Math.max(0, H - Math.min(run.radius * 0.85, H));
  const rad = run.radius;
  if (run.phase === 'boss' || run.phase === 'bossIntro') {
    // dodge: the spot where the swarm overlaps the incoming zones the least
    const sl = run.slam;
    if (!sl || sl.hit > 0) return run.x;
    let bx = run.x;
    let best = Infinity;
    for (let x = -lim; x <= lim + 0.01; x += Math.max(3, lim / 30)) {
      const c = x * 0.75;
      const r = rad * 0.85;
      let ov = 0;
      for (const [z0, z1] of sl.zones) ov += Math.max(0, Math.min(c + r, z1) - Math.max(c - r, z0));
      const sc = ov + Math.abs(x - run.x) * 0.02;
      if (sc < best) {
        best = sc;
        bx = x;
      }
    }
    return bx;
  }
  // running: score candidate x positions by what lies ahead
  let best = run.x;
  let bs = -Infinity;
  const gate = lv.gates.find((g) => !g.chosen && g.d - run.d > -5 && g.d - run.d < 330);
  for (let x = -lim; x <= lim + 0.01; x += Math.max(4, lim / 14)) {
    let s = -Math.abs(x - run.x) * 0.01;
    if (gate) {
      const ev = (op, slot) => {
        if (slot) {
          if (gate._read === undefined) gate._read = rng() < skill.slotSkill;
          if (gate._read) return applyGate(run.count, slotOp(slot, run.time + (gate.d - run.d) / lv.speed));
          return slot.ops.reduce((a, o) => a + applyGate(run.count, o), 0) / slot.ops.length;
        }
        if (op.op === '?') return run.count * 1.25;
        return applyGate(run.count, op, op.op === '+' ? run.stats.plusBoost : 1);
      };
      const l = ev(gate.left, gate.slot && gate.slot.side < 0 ? gate.slot : null);
      const r = ev(gate.right, gate.slot && gate.slot.side > 0 ? gate.slot : null);
      if (gate._pick === undefined || gate._read) gate._pick = (l >= r ? -1 : 1) * (rng() < skill.gateErr ? -1 : 1);
      s += (Math.sign(x || 1) === gate._pick ? 1000 : 0) + Math.min(Math.abs(x), 60);
    }
    for (const o of lv.obstacles) {
      if (o.smashed) continue;
      const dd = o.d - run.d;
      if (dd < -40 || dd > 260) continue;
      if (run.giantT > 0) {
        s += 30;
        continue;
      }
      const tArr = Math.max(0, dd) / lv.speed;
      const ox = o.x + (o.move ? Math.sin((run.time + tArr) * o.move.speed + o.move.phase) * o.move.amp : 0);
      for (const c of o.colliders) {
        const gap = Math.abs(ox + c.dx - x) - (c.r + rad);
        if (gap < 0) s += gap * (run.count / 20 + 1) * 0.5;
      }
    }
    for (const st of lv.stomps) {
      if (st.state !== 'warn') continue;
      const gap = Math.abs(st.x - x) - (58 + rad);
      if (gap < 0 && run.shieldT <= 0) s += gap * 6;
    }
    for (const q of lv.squads) {
      if (q.dead || q.d - run.d < -40 || q.d - run.d > 300) continue;
      const sr = 14 + Math.sqrt(Math.min(q.hp, 40)) * 9;
      if (Math.abs(q.x - x) < sr + rad) s -= (q.hp / run.power) * 4 - q.reward * 0.3;
    }
    for (const c of lv.crumbs) {
      if (c.taken || c.d < run.d || c.d - run.d > 220) continue;
      if (Math.abs(c.x - x) < rad + 8 + run.stats.magnet) s += c.value * 1.5;
    }
    const ahead = (d, m) => d - run.d > 0 && d - run.d < m;
    for (const j of lv.jars) if (!j.open && ahead(j.d, 280) && Math.abs(j.x - x) < rad + 24) s += j.n * 4;
    for (const p of lv.powerups) if (!p.taken && ahead(p.d, 240) && Math.abs(p.x - x) < rad + 22) s += 25;
    for (const b of lv.boosts) if (!b.used && ahead(b.d, 240) && Math.abs(b.x - x) < 38 + rad * 0.4) s += 20;
    for (const f of lv.foods) if (f.state === 'idle' && ahead(f.d, 280) && Math.abs(f.x - x) < rad + f.r) s += run.count >= f.need ? 15 : -10;
    for (const b of lv.bugs) if ((b.state === 'run' || b.state === 'idle') && b.d - run.d < 300) s -= Math.abs(b.x - x) * 0.15;
    if (s > bs) {
      bs = s;
      best = x;
    }
  }
  return best;
}

/** Plays one level to the end and returns its result plus how big the swarm was at the boss. */
function play(level, stats, skill, seed, fails) {
  const lv = generateLevel(level, hashString('level-' + level));
  lv.bossHP = mercyHP(lv.bossHP, fails);
  let result = null;
  const run = new Run(lv, stats, sound, (r) => (result = r));
  let s = seed;
  const rng = () => (s = (s * 16807) % 2147483647) / 2147483647;
  run.pointerDown(0);
  run.pointerUp();
  let target = 0;
  let atBoss = 0;
  const pending = [];
  for (let i = 0; i < 60 * 240 && !result; i++) {
    // decide every 3 frames, act after the reaction delay
    if (i % 3 === 0) pending.push({ at: run.time + skill.react, x: choose(run, skill, rng) + (rng() - 0.5) * skill.noise });
    while (pending.length && pending[0].at <= run.time) target = pending.shift().x;
    run.targetX = target - run.windOff; // lean into fan wind like a player would
    run.update(1 / 60);
    if (run.phase === 'boss' && !atBoss) atBoss = Math.round(run.count);
  }
  return { ...(result ?? { win: false, stars: 0, total: 0, antsLeft: 0 }), boss: lv.bossHP, atBoss };
}

/**
 * A whole campaign: play from level 1, retry on a loss (with the mercy rule), and between
 * runs spend honey like a player would (cheapest upgrade first, a few useful captains).
 */
export function campaign({ skill, maxLevel = 30, maxRuns = 200, seed = 7 }) {
  const save = { level: 1, honey: 0, upgrades: { colony: 0, power: 0, magnet: 0, armor: 0, honey: 0 }, captain: 'basic', owned: ['basic'] };
  const rows = [];
  let fails = 0;
  for (let n = 0; n < maxRuns && save.level <= maxLevel; n++) {
    const stats = upgradeStats(save.upgrades, save.captain);
    const r = play(save.level, stats, skill, seed + n * 101, fails);
    rows.push({ level: save.level, win: r.win, stars: r.stars, boss: r.boss, atBoss: r.atBoss, power: stats.power, tries: fails + 1 });
    save.honey += r.total * (r.win ? 1.9 : 1); // the lucky bar pays ~1.9x on average
    if (r.win) {
      save.level++;
      fails = 0;
    } else fails++;
    shop(save);
  }
  return { rows, upgrades: save.upgrades, captain: save.captain };
}

/** Each level `reps` times with a fixed upgrade pace (`perLevel` upgrade levels per game level). */
export function sweep({ skill, maxLevel = 30, reps = 3, perLevel = 0.6, seed = 7 }) {
  const rows = [];
  for (let level = 1; level <= maxLevel; level++) {
    const k = Math.round(perLevel * level);
    const u = { colony: Math.min(20, k), power: Math.min(20, k), magnet: Math.min(10, k), armor: Math.min(15, k), honey: Math.min(15, k) };
    for (let i = 0; i < reps; i++) {
      const r = play(level, upgradeStats(u, 'basic'), skill, seed + level * 1000 + i * 101, 0);
      rows.push({ level, win: r.win, stars: r.stars });
    }
  }
  return rows;
}

function shop(save) {
  for (;;) {
    let best = null;
    let bc = Infinity;
    for (const u of UPGRADES) {
      const lvl = save.upgrades[u.id];
      if (lvl >= u.max) continue;
      const c = upgradeCost(u, lvl) * (u.id === 'honey' || u.id === 'magnet' ? 1.3 : 1);
      if (c < bc) {
        bc = c;
        best = u;
      }
    }
    const cap = CAPTAINS.find((c) => !save.owned.includes(c.id) && ['hat', 'ninja', 'knight'].includes(c.id) && c.cost <= save.honey);
    if (cap && (!best || cap.cost < bc * 3)) {
      save.honey -= cap.cost;
      save.owned.push(cap.id);
      if (save.captain !== 'knight') save.captain = cap.id;
      continue;
    }
    if (!best) return;
    const cost = upgradeCost(best, save.upgrades[best.id]);
    if (cost > save.honey) return;
    save.honey -= cost;
    save.upgrades[best.id]++;
  }
}
