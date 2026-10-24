// Hand-drawn "doodle" art, all procedural. Outlines "boil" (jitter a few
// times per second) to look like a flip-book cartoon.
import type { BossKind, CaptainId, ThemeDef } from './data';

export const INK = '#2b2233';
export const TAU = Math.PI * 2;
type C = CanvasRenderingContext2D;

let boil = 0;
export const setBoil = (time: number) => (boil = Math.floor(time * 6) % 3);

function jit(seed: number) {
  const s = Math.sin(seed * 12.9898 + boil * 78.233) * 43758.5453;
  return s - Math.floor(s) - 0.5;
}

/** Closed smooth blob around (x,y). amt = relative wobble of the radius. */
export function blob(ctx: C, x: number, y: number, rx: number, ry: number, seed = 1, amt = 0.08, rot = 0, n = 12) {
  const px: number[] = [];
  const py: number[] = [];
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const k = 1 + jit(seed + i * 7.31) * amt * 2;
    const lx = Math.cos(a) * rx * k;
    const ly = Math.sin(a) * ry * k;
    px.push(x + lx * cr - ly * sr);
    py.push(y + lx * sr + ly * cr);
  }
  ctx.beginPath();
  ctx.moveTo((px[0] + px[1]) / 2, (py[0] + py[1]) / 2);
  for (let i = 1; i <= n; i++) {
    const a = i % n;
    const b = (i + 1) % n;
    ctx.quadraticCurveTo(px[a], py[a], (px[a] + px[b]) / 2, (py[a] + py[b]) / 2);
  }
  ctx.closePath();
}

/** Wobbly rounded rectangle path. */
export function rrect(ctx: C, x: number, y: number, w: number, h: number, r: number, seed = 1, amt = 1.2) {
  const j = (i: number) => jit(seed + i * 3.7) * amt * 2;
  ctx.beginPath();
  ctx.moveTo(x + r + j(0), y + j(1));
  ctx.lineTo(x + w - r + j(2), y + j(3));
  ctx.quadraticCurveTo(x + w + j(4), y + j(5), x + w + j(6), y + r + j(7));
  ctx.lineTo(x + w + j(8), y + h - r + j(9));
  ctx.quadraticCurveTo(x + w + j(10), y + h + j(11), x + w - r + j(12), y + h + j(13));
  ctx.lineTo(x + r + j(14), y + h + j(15));
  ctx.quadraticCurveTo(x + j(16), y + h + j(17), x + j(18), y + h - r + j(19));
  ctx.lineTo(x + j(20), y + r + j(21));
  ctx.quadraticCurveTo(x + j(22), y + j(23), x + r + j(0), y + j(1));
  ctx.closePath();
}

export function paint(ctx: C, fill: string | null, lw = 2.2, stroke = INK) {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (lw > 0) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

export function eye(ctx: C, x: number, y: number, r: number, lookX = 0, lookY = 0, lw = 1.4) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  paint(ctx, '#fff', lw);
  ctx.beginPath();
  ctx.arc(x + lookX * r * 0.4, y + lookY * r * 0.4, r * 0.5, 0, TAU);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + lookX * r * 0.4 - r * 0.18, y + lookY * r * 0.4 - r * 0.2, r * 0.17, 0, TAU);
  ctx.fillStyle = '#fff';
  ctx.fill();
}

export function cheeks(ctx: C, x: number, y: number, dx: number, r: number) {
  ctx.fillStyle = 'rgba(255,120,150,0.55)';
  ctx.beginPath();
  ctx.ellipse(x - dx, y, r, r * 0.6, 0, 0, TAU);
  ctx.ellipse(x + dx, y, r, r * 0.6, 0, 0, TAU);
  ctx.fill();
}

export function smile(ctx: C, x: number, y: number, w: number, lw = 1.6, open = false) {
  ctx.beginPath();
  if (open) {
    ctx.arc(x, y, w, 0, Math.PI);
    ctx.closePath();
    paint(ctx, '#ff6b81', lw);
  } else {
    ctx.arc(x, y - w * 0.4, w, 0.2 * Math.PI, 0.8 * Math.PI);
    paint(ctx, null, lw);
  }
}

export function text(ctx: C, s: string, x: number, y: number, size: number, fill = '#fff', stroke = INK, align: CanvasTextAlign = 'center') {
  ctx.font = `800 ${size}px "Baloo 2", "Trebuchet MS", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.22;
  ctx.strokeStyle = stroke;
  ctx.strokeText(s, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(s, x, y);
}

// ---------------------------------------------------------------- ants
const SPRITE = 64;

/** Pre-render one ant (pointing up) per leg frame. */
function makeAnt(frame: number, body: string, shine: string, eyeLook: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = cv.height = SPRITE * 2;
  const g = cv.getContext('2d')!;
  g.scale(2, 2);
  g.translate(32, 32);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // legs: alternating tripod gait
  const swing = [0.35, 0, -0.35, 0][frame];
  g.strokeStyle = INK;
  g.lineWidth = 2.6;
  for (let side = -1; side <= 1; side += 2) {
    for (let k = 0; k < 3; k++) {
      const s = (k % 2 === 0 ? swing : -swing) * side;
      const baseA = [-0.7, 0, 0.6][k] + s;
      const y0 = -2 + k * 3;
      const kx = side * 12;
      const ky = y0 + Math.sin(baseA) * 10 - 2;
      g.beginPath();
      g.moveTo(side * 4, y0);
      g.lineTo(kx, ky);
      g.lineTo(side * 17, ky + 6 + k * 2);
      g.stroke();
    }
  }
  // antennae
  g.lineWidth = 2;
  for (let side = -1; side <= 1; side += 2) {
    const wig = frame % 2 ? 1.5 : -1.5;
    g.beginPath();
    g.moveTo(side * 4, -22);
    g.quadraticCurveTo(side * 6, -34, side * (13 + wig), -30);
    g.stroke();
    g.beginPath();
    g.arc(side * (13 + wig), -30, 2.4, 0, TAU);
    g.fillStyle = '#ff8fab';
    g.fill();
    g.stroke();
  }
  const part = (x: number, y: number, rx: number, ry: number) => {
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, TAU);
    g.fillStyle = body;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = INK;
    g.stroke();
  };
  part(0, 14, 11, 13); // abdomen
  part(0, -1, 6, 7); // thorax
  part(0, -15, 10, 9); // head
  // shine
  g.fillStyle = shine;
  g.beginPath();
  g.ellipse(-4, 9, 3.5, 5, -0.4, 0, TAU);
  g.fill();
  g.beginPath();
  g.ellipse(-5, -19, 2.5, 2, -0.4, 0, TAU);
  g.fill();
  // stripes on abdomen
  g.strokeStyle = 'rgba(255,255,255,0.18)';
  g.lineWidth = 1.6;
  g.beginPath();
  g.arc(0, 4, 10, 0.25 * Math.PI, 0.75 * Math.PI);
  g.stroke();
  g.beginPath();
  g.arc(0, 10, 11, 0.25 * Math.PI, 0.75 * Math.PI);
  g.stroke();
  // googly eyes + cheeks
  eye(g, -4.5, -17, 4.6, eyeLook, -0.6, 1.2);
  eye(g, 4.5, -17, 4.6, -eyeLook * 0.5, -0.8, 1.2);
  cheeks(g, 0, -10, 6.5, 2);
  return cv;
}

export interface AntSprites {
  frames: HTMLCanvasElement[];
}

export function makeAntSprites(body = '#3a2d45', shine = 'rgba(255,255,255,0.55)'): AntSprites {
  return { frames: [0, 1, 2, 3].map((f) => makeAnt(f, body, shine, f % 2 ? 0.5 : -0.5)) };
}

export function drawAnt(ctx: C, spr: AntSprites, x: number, y: number, angle: number, size: number, frame: number) {
  const img = spr.frames[frame & 3];
  if (angle === 0) {
    ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
  ctx.restore();
}

/** Accessories on the captain ant, drawn in sprite space (head centre at 0,-15). */
export function drawAccessory(ctx: C, id: CaptainId, x: number, y: number, size: number, t: number) {
  if (id === 'basic') return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / SPRITE, size / SPRITE);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (id) {
    case 'hat': {
      blob(ctx, 0, -18, 17, 15, 3, 0.03);
      paint(ctx, '#f6dc8f', 2);
      ctx.strokeStyle = '#c9a54b';
      ctx.lineWidth = 1.2;
      for (const r of [5, 10]) {
        ctx.beginPath();
        ctx.ellipse(0, -18, r * 1.1, r, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.fillStyle = '#e2788a';
      ctx.beginPath();
      ctx.arc(0, -18, 2.4, 0, TAU);
      ctx.fill();
      break;
    }
    case 'ninja': {
      ctx.beginPath();
      ctx.rect(-11, -22, 22, 5);
      paint(ctx, '#ef4b5f', 1.6);
      const w = Math.sin(t * 12) * 3;
      ctx.beginPath();
      ctx.moveTo(9, -20);
      ctx.quadraticCurveTo(16, -12 + w, 22, -6 - w);
      ctx.moveTo(9, -19);
      ctx.quadraticCurveTo(14, -8 - w, 17, 0 + w);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ef4b5f';
      ctx.stroke();
      break;
    }
    case 'chubby': {
      ctx.beginPath();
      ctx.ellipse(0, 14, 15, 15, 0, 0, TAU);
      paint(ctx, '#3a2d45', 2);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.ellipse(-6, 9, 4, 6, -0.4, 0, TAU);
      ctx.fill();
      // a cookie snack held in the mouth
      ctx.beginPath();
      ctx.arc(0, -28, 6, 0, TAU);
      paint(ctx, '#e0a96d', 1.4);
      ctx.fillStyle = '#6b4226';
      ctx.fillRect(-2, -30, 2, 2);
      ctx.fillRect(2, -27, 2, 2);
      break;
    }
    case 'dj': {
      ctx.beginPath();
      ctx.arc(0, -16, 12, Math.PI * 1.05, Math.PI * 1.95);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ff5fa2';
      ctx.stroke();
      for (const s of [-1, 1]) {
        blob(ctx, s * 11, -14, 4, 5, 9 + s, 0.05);
        paint(ctx, '#ff5fa2', 1.6);
      }
      // shades
      ctx.beginPath();
      ctx.rect(-9, -20, 7, 5);
      ctx.rect(2, -20, 7, 5);
      paint(ctx, '#20202a', 1.2);
      ctx.beginPath();
      ctx.moveTo(-2, -18);
      ctx.lineTo(2, -18);
      ctx.stroke();
      break;
    }
    case 'astro': {
      ctx.beginPath();
      ctx.arc(0, -15, 15, 0, TAU);
      ctx.fillStyle = 'rgba(180,230,255,0.35)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#7fb2d9';
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, -15, 11, 1.1 * Math.PI, 1.4 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -30);
      ctx.lineTo(0, -38);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -39, 2.5, 0, TAU);
      ctx.fillStyle = Math.sin(t * 8) > 0 ? '#ff4d6d' : '#ffd166';
      ctx.fill();
      break;
    }
    case 'knight': {
      ctx.beginPath();
      ctx.arc(0, -16, 11, Math.PI, 0);
      ctx.lineTo(11, -12);
      ctx.lineTo(-11, -12);
      ctx.closePath();
      paint(ctx, '#cfd8e3', 1.8);
      ctx.beginPath();
      ctx.moveTo(-8, -15);
      ctx.lineTo(8, -15);
      ctx.lineWidth = 1.4;
      ctx.stroke();
      const w = Math.sin(t * 9) * 2;
      blob(ctx, 0 + w, -30, 4, 6, 4, 0.1);
      paint(ctx, '#ef4b5f', 1.4);
      break;
    }
    case 'king': {
      ctx.beginPath();
      ctx.moveTo(-10, -20);
      ctx.lineTo(-11, -31);
      ctx.lineTo(-5, -25);
      ctx.lineTo(0, -33);
      ctx.lineTo(5, -25);
      ctx.lineTo(11, -31);
      ctx.lineTo(10, -20);
      ctx.closePath();
      paint(ctx, '#ffd166', 1.8);
      for (const [gx, gy, c] of [[-5, -23, '#ef4b5f'], [0, -24, '#5ec2f2'], [5, -23, '#7bd88f']] as const) {
        ctx.beginPath();
        ctx.arc(gx, gy, 1.8, 0, TAU);
        ctx.fillStyle = c;
        ctx.fill();
      }
      break;
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- beetles
function makeBeetle(frame: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 96;
  const g = cv.getContext('2d')!;
  g.scale(2, 2);
  g.translate(24, 24);
  g.lineCap = 'round';
  g.strokeStyle = INK;
  g.lineWidth = 2.2;
  const s = frame ? 2.5 : -2.5;
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.moveTo(side * 8, 4 + k * 5);
      g.lineTo(side * 17, 2 + k * 6 + (k % 2 ? s : -s) * side);
      g.stroke();
    }
  }
  // shell faces DOWN (towards the ants)
  g.beginPath();
  g.ellipse(0, 4, 13, 14, 0, 0, TAU);
  g.fillStyle = '#7a4fd6';
  g.fill();
  g.stroke();
  g.beginPath();
  g.moveTo(0, -9);
  g.lineTo(0, 18);
  g.lineWidth = 1.6;
  g.stroke();
  g.fillStyle = '#c7b3ff';
  for (const [x, y] of [[-6, 1], [6, 1], [-5, 10], [5, 10]]) {
    g.beginPath();
    g.arc(x, y, 2.4, 0, TAU);
    g.fill();
  }
  g.beginPath();
  g.ellipse(0, 18, 9, 7, 0, 0, TAU);
  g.fillStyle = '#4a2f8a';
  g.lineWidth = 2;
  g.fill();
  g.stroke();
  eye(g, -4, 19, 3.3, 0, 0.6, 1);
  eye(g, 4, 19, 3.3, 0, 0.6, 1);
  // angry brows
  g.beginPath();
  g.moveTo(-7, 14);
  g.lineTo(-1, 16);
  g.moveTo(7, 14);
  g.lineTo(1, 16);
  g.lineWidth = 1.8;
  g.stroke();
  return cv;
}
let beetleFrames: HTMLCanvasElement[] | null = null;
export function drawBeetle(ctx: C, x: number, y: number, size: number, frame: number) {
  beetleFrames ??= [makeBeetle(0), makeBeetle(1)];
  ctx.drawImage(beetleFrames[frame & 1], x - size / 2, y - size / 2, size, size);
}

// ---------------------------------------------------------------- pickups
export type CrumbKind = 'bread' | 'sugar' | 'candy';
const CANDY = ['#ff7eb6', '#7ed6ff', '#b5f27a', '#ffd166'];

export function drawCrumb(ctx: C, kind: CrumbKind, x: number, y: number, seed: number, t: number) {
  const bob = Math.sin(t * 4 + seed) * 1.2;
  y += bob;
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.ellipse(x + 1.5, y + 4 - bob, 6, 3, 0, 0, TAU);
  ctx.fill();
  if (kind === 'bread') {
    blob(ctx, x, y, 5.5, 4.5, seed, 0.12, seed);
    paint(ctx, '#f2c27b', 1.6);
    ctx.fillStyle = '#c98b3d';
    ctx.fillRect(x - 2, y - 1, 1.5, 1.5);
    ctx.fillRect(x + 1, y + 1, 1.5, 1.5);
  } else if (kind === 'sugar') {
    rrect(ctx, x - 5, y - 5, 10, 10, 2, seed, 0.4);
    paint(ctx, '#ffffff', 1.6);
    ctx.fillStyle = 'rgba(160,200,255,0.6)';
    ctx.fillRect(x - 3, y - 3, 3, 3);
  } else {
    const c = CANDY[seed % CANDY.length];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 2 + seed);
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.lineTo(-11, -4);
    ctx.lineTo(-11, 4);
    ctx.closePath();
    ctx.moveTo(7, 0);
    ctx.lineTo(11, -4);
    ctx.lineTo(11, 4);
    ctx.closePath();
    paint(ctx, c, 1.4);
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, TAU);
    paint(ctx, c, 1.6);
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 1.5);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------- gates
/** `slot` >= 0 marks a slot gate: it is the 0..1 progress through the current face, used to roll the label in. */
export function drawGate(ctx: C, x: number, y: number, w: number, label: string, good: boolean | 'mystery', used: number, t: number, seed: number, slot = -1) {
  const h = 44;
  const pop = used > 0 ? 1 + used * 0.4 : 1 + Math.sin(t * 5 + seed) * 0.02;
  const alpha = used > 0 ? Math.max(0, 1 - used * 1.8) : 1;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(pop, pop);
  const col = good === 'mystery' ? `hsl(${(t * 90 + seed * 40) % 360}, 75%, 72%)` : good ? '#7bd88f' : '#ff8a80';
  const dark = good === 'mystery' ? '#7a4fd6' : good ? '#3fa35a' : '#d9534f';
  rrect(ctx, -w / 2 + 4, -h / 2, w - 8, h, 12, seed, 0.8);
  ctx.globalAlpha = alpha * 0.82;
  paint(ctx, col, 0);
  ctx.globalAlpha = alpha;
  paint(ctx, null, 2.6, dark);
  if (slot >= 0) {
    // marching golden lights around a slot gate
    ctx.save();
    rrect(ctx, -w / 2, -h / 2 - 4, w, h + 8, 15, seed, 0);
    ctx.setLineDash([3, 9]);
    ctx.lineDashOffset = -t * 40;
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#ffd166';
    ctx.stroke();
    ctx.restore();
  }
  // diagonal stripes
  ctx.save();
  rrect(ctx, -w / 2 + 4, -h / 2, w - 8, h, 12, seed, 0);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 7;
  const off = (t * 20) % 22;
  for (let sx = -w / 2 - 40; sx < w / 2 + 40; sx += 22) {
    ctx.beginPath();
    ctx.moveTo(sx + off, h / 2);
    ctx.lineTo(sx + off + 26, -h / 2);
    ctx.stroke();
  }
  if (slot >= 0) {
    // slot-machine reel: each new face drops in from the top
    text(ctx, label, 0, 2 - Math.max(0, 1 - slot * 6) * 30, 26, '#fff', dark);
  }
  ctx.restore();
  if (slot < 0) {
    text(ctx, label, 0, 2, 26, '#fff', dark);
  } else {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * (w / 2 - 12), -7);
      ctx.lineTo(s * (w / 2 - 22), 1);
      ctx.lineTo(s * (w / 2 - 12), 9);
      ctx.closePath();
      paint(ctx, '#fff', 2, dark);
    }
    ctx.font = '17px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎰', 0, -h / 2 - 9);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- rescue jar & boost pad
/**
 * Glass jar of trapped ants. `inside` draws the prisoners in jar-local
 * coordinates, between the back of the jar and the glass. `open` counts
 * seconds since the swarm broke it (0 = still closed).
 */
export function drawJar(ctx: C, x: number, y: number, seed: number, t: number, open: number, inside: () => void) {
  ctx.fillStyle = 'rgba(0,0,0,0.13)';
  ctx.beginPath();
  ctx.ellipse(x + 3, y + 27, 28 * (1 + open), 8, 0, 0, TAU);
  ctx.fill();
  const fade = Math.max(0, 1 - open * 2.4);
  if (fade <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(open > 0 ? 0 : Math.sin(t * 9 + seed) * 0.06); // rattled by the ants inside
  ctx.globalAlpha = fade;
  rrect(ctx, -25, -24, 50, 52, 15, seed, 0.6);
  paint(ctx, 'rgba(205,238,255,0.55)', 0);
  inside();
  ctx.globalAlpha = fade;
  rrect(ctx, -25, -24, 50, 52, 15, seed, 0.6);
  ctx.fillStyle = 'rgba(205,238,255,0.25)';
  ctx.fill();
  paint(ctx, null, 2.6, '#5d8fb3');
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-16, -12);
  ctx.lineTo(-16, 12);
  ctx.stroke();
  // lid pops off and spins away when opened
  ctx.translate(open * 70, -open * 160);
  ctx.rotate(open * 9);
  rrect(ctx, -21, -33, 42, 12, 5, seed + 3, 0.5);
  paint(ctx, '#ef4b5f', 2.4);
  ctx.fillStyle = '#fff';
  for (const dx of [-12, 0, 12]) {
    ctx.beginPath();
    ctx.arc(dx, -27, 2.2, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** Speed pad. `y` is the screen y of its near edge; it stretches `l` up the track. */
export function drawBoostPad(ctx: C, x: number, y: number, w: number, l: number, t: number, used: boolean) {
  ctx.save();
  rrect(ctx, x - w / 2, y - l, w, l, 14, x, 0.6);
  paint(ctx, used ? '#d8f1fb' : '#7ed6ff', 2.6);
  ctx.clip();
  for (let i = 0; i < 3; i++) {
    const k = (t * (used ? 0.6 : 2.2) + i / 3) % 1;
    const cy = y - 8 - k * (l - 10);
    ctx.globalAlpha = Math.sin(k * Math.PI);
    ctx.beginPath();
    ctx.moveTo(x - w * 0.3, cy + 9);
    ctx.lineTo(x, cy - 7);
    ctx.lineTo(x + w * 0.3, cy + 9);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 11;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.strokeStyle = used ? '#fff' : '#ffd166';
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- golden ladybug
/**
 * The runaway golden ladybug, head pointing up the track. `run` makes its
 * legs scurry and wings buzz; `fly` (0..1) lifts it off when it escapes.
 */
export function drawLadybug(ctx: C, x: number, y: number, t: number, seed: number, run: boolean, fly: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(x + 2, y + 16, 15 * (1 - fly * 0.6), 5 * (1 - fly * 0.6), 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y - fly * 140 - (run ? Math.abs(Math.sin(t * 20)) * 2 : Math.sin(t * 3 + seed) * 1.5));
  ctx.rotate(run ? Math.sin(t * 14) * 0.18 : 0);
  // golden glow
  ctx.globalAlpha = 0.28 + Math.sin(t * 6 + seed) * 0.12;
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, TAU);
  ctx.fillStyle = '#ffe066';
  ctx.fill();
  ctx.globalAlpha = 1;
  // legs
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (const sd of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const w = run ? Math.sin(t * 30 + i * 2 + sd) * 4 : 0;
      ctx.beginPath();
      ctx.moveTo(sd * 10, -5 + i * 7);
      ctx.lineTo(sd * 18, -8 + i * 8 + w);
      ctx.stroke();
    }
  }
  // buzzing wings
  if (run || fly > 0) {
    ctx.globalAlpha = 0.55;
    for (const sd of [-1, 1]) {
      ctx.save();
      ctx.rotate(sd * (0.5 + Math.sin(t * 60) * 0.35));
      ctx.beginPath();
      ctx.ellipse(sd * 12, 4, 9, 16, 0, 0, TAU);
      paint(ctx, '#ffffff', 1.4);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  // head + antennae
  ctx.beginPath();
  ctx.moveTo(-3, -18);
  ctx.quadraticCurveTo(-6, -27, -10, -27);
  ctx.moveTo(3, -18);
  ctx.quadraticCurveTo(6, -27, 10, -27);
  paint(ctx, null, 1.8);
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(sd * 10, -27, 2.4, 0, TAU);
    paint(ctx, '#ffd166', 1.4);
  }
  ctx.beginPath();
  ctx.arc(0, -13, 8.5, 0, TAU);
  paint(ctx, '#3a2d45', 2);
  eye(ctx, -3.6, -15, 3, 0, run ? -0.7 : 0.3, 1);
  eye(ctx, 3.6, -15, 3, 0, run ? -0.7 : 0.3, 1);
  // shell
  blob(ctx, 0, 3, 15, 16, seed, 0.04);
  paint(ctx, '#ffc93c', 2.4);
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(0, 18);
  paint(ctx, null, 2);
  ctx.fillStyle = INK;
  for (const [sx, sy, r] of [[-7, -2, 3.3], [7, -2, 3.3], [-6, 10, 2.7], [6, 10, 2.7]]) {
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, TAU);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(-6, -4, 7, 3.5, 4.4);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // twinkle
  const tw = (t * 1.3 + seed * 0.37) % 1;
  if (tw < 0.5) {
    const s = Math.sin((tw / 0.5) * Math.PI) * 6;
    ctx.translate(13, -14);
    ctx.rotate(t * 3);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? s * 0.35 : s;
      ctx.lineTo(Math.cos((i / 8) * TAU) * r, Math.sin((i / 8) * TAU) * r);
    }
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
  ctx.restore();
}

/** Comic speech bubble with its tail pointing down at (x, y). */
export function drawSpeech(ctx: C, s: string, x: number, y: number, size: number, k: number, fill = '#fff') {
  ctx.font = `800 ${size}px "Baloo 2", "Trebuchet MS", sans-serif`;
  const w = ctx.measureText(s).width + size * 1.1;
  const h = size * 1.55;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.beginPath();
  ctx.moveTo(-5, -h * 0.35 - 6);
  ctx.lineTo(0, 0);
  ctx.lineTo(6, -h * 0.35 - 6);
  paint(ctx, fill, 2);
  rrect(ctx, -w / 2, -h - 8, w, h, h * 0.45, x, 0.5);
  paint(ctx, fill, 2);
  ctx.beginPath();
  ctx.moveTo(-4.5, -9);
  ctx.lineTo(5.5, -9);
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = fill;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s, 0, -h / 2 - 7);
  ctx.restore();
}

// ---------------------------------------------------------------- power-ups
const POWER_ICON = { shield: '🛡️', magnet: '🧲', rage: '🔥', giant: '🍄' } as const;
const POWER_COL = { shield: '#7ed6ff', magnet: '#ff7eb6', rage: '#ffb347', giant: '#b5f27a' } as const;

export function drawPowerUp(ctx: C, kind: keyof typeof POWER_ICON, x: number, y: number, seed: number, t: number) {
  const bob = Math.sin(t * 3 + seed) * 4;
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.ellipse(x, y + 22, 16 - bob * 0.5, 5, 0, 0, TAU);
  ctx.fill();
  y += bob - 6;
  // soft glow ring
  ctx.globalAlpha = 0.35 + Math.sin(t * 6 + seed) * 0.15;
  ctx.beginPath();
  ctx.arc(x, y, 26, 0, TAU);
  ctx.fillStyle = POWER_COL[kind];
  ctx.fill();
  ctx.globalAlpha = 1;
  blob(ctx, x, y, 19, 19, seed, 0.05);
  paint(ctx, 'rgba(255,255,255,0.85)', 2.4);
  ctx.beginPath();
  ctx.arc(x - 7, y - 8, 4, 0, TAU);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(POWER_ICON[kind], x, y + 1);
}

/** The bubble that wraps the swarm while the shield is up. */
export function drawShield(ctx: C, x: number, y: number, r: number, t: number, fade: number) {
  ctx.save();
  ctx.globalAlpha = 0.25 * fade;
  blob(ctx, x, y, r, r * 0.95, 3, 0.03, t);
  ctx.fillStyle = '#bfeaff';
  ctx.fill();
  ctx.globalAlpha = 0.8 * fade;
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#7ed6ff';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - r * 0.4, y - r * 0.45, r * 0.18, 3.6, 4.6);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

/** Red warning stripe on the half of the arena the boss is about to smash. */
export function drawSlamZone(ctx: C, x0: number, x1: number, y0: number, y1: number, k: number, t: number, hit: boolean) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.clip();
  ctx.globalAlpha = hit ? 0.55 : 0.18 + k * 0.3 + Math.sin(t * 22) * 0.06 * k;
  ctx.fillStyle = hit ? '#ffffff' : '#ff5d6c';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  if (!hit) {
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 10;
    const off = (t * 60) % 36;
    for (let sx = x0 - 80; sx < x1 + 80; sx += 36) {
      ctx.beginPath();
      ctx.moveTo(sx + off, y1);
      ctx.lineTo(sx + off + 50, y0);
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.lineDashOffset = -t * 30;
  ctx.strokeStyle = '#d9534f';
  ctx.lineWidth = 3;
  ctx.strokeRect(x0 + 2, y0 + 2, x1 - x0 - 4, y1 - y0 - 4);
  ctx.restore();
}

// ---------------------------------------------------------------- obstacles
export type ObstacleKind = 'spoon' | 'eraser' | 'peel' | 'tack' | 'pea' | 'button';

export function drawObstacle(ctx: C, kind: ObstacleKind, x: number, y: number, seed: number, t: number, flip: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.13)';
  switch (kind) {
    case 'spoon': {
      ctx.scale(flip, 1);
      ctx.beginPath();
      ctx.ellipse(-30, 6, 30, 22, 0, 0, TAU);
      ctx.rect(-4, 0, 96, 12);
      ctx.fill();
      rrect(ctx, -6, -9, 98, 13, 6, seed, 0.6);
      paint(ctx, '#d4dbe6', 2.2);
      blob(ctx, -34, -2, 30, 22, seed, 0.03);
      paint(ctx, '#e8eef6', 2.4);
      blob(ctx, -36, -2, 21, 14, seed + 4, 0.04);
      paint(ctx, '#c4cfdc', 0);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(-38, -4, 14, 3.6, 4.4);
      ctx.stroke();
      break;
    }
    case 'eraser': {
      ctx.rotate(0.15 * flip);
      ctx.fillRect(-36, -14, 76, 34);
      rrect(ctx, -40, -20, 80, 34, 8, seed);
      paint(ctx, '#ffb3c7', 2.4);
      ctx.beginPath();
      ctx.rect(-40, -20, 28, 34);
      paint(ctx, '#7ec8f2', 2.2);
      text(ctx, 'ERASE', 12, -3, 11, '#fff', '#e07a98');
      break;
    }
    case 'peel': {
      ctx.rotate(seed);
      const arms = 4;
      for (let i = 0; i < arms; i++) {
        ctx.save();
        ctx.rotate((i / arms) * TAU + 0.3);
        blob(ctx, 0, -22, 10, 22, seed + i, 0.06);
        paint(ctx, '#ffe066', 2.2);
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, TAU);
      paint(ctx, '#ffd23f', 2.2);
      ctx.fillStyle = '#8a6d1f';
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, TAU);
      ctx.fill();
      break;
    }
    case 'tack': {
      ctx.beginPath();
      ctx.ellipse(3, 4, 18, 16, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, TAU);
      paint(ctx, '#ff5d73', 2.4);
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, TAU);
      paint(ctx, '#ff8fa0', 1.6);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(-6, -7, 4, 2.5, -0.6, 0, TAU);
      ctx.fill();
      break;
    }
    case 'pea': {
      ctx.beginPath();
      ctx.ellipse(3, 5, 17, 13, 0, 0, TAU);
      ctx.fill();
      blob(ctx, 0, 0, 17, 17, seed, 0.03);
      paint(ctx, '#8fd16a', 2.4);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.ellipse(-6, -7, 5, 3, -0.6, 0, TAU);
      ctx.fill();
      // smug little face
      const look = Math.sin(t * 2);
      eye(ctx, -5 + look, -1, 3.6, look, 0, 1.2);
      eye(ctx, 5 + look, -1, 3.6, look, 0, 1.2);
      smile(ctx, look, 6, 4, 1.4);
      break;
    }
    case 'button': {
      ctx.beginPath();
      ctx.arc(3, 4, 24, 0, TAU);
      ctx.fill();
      blob(ctx, 0, 0, 24, 24, seed, 0.02);
      paint(ctx, '#ffc35c', 2.6);
      ctx.beginPath();
      ctx.arc(0, 0, 17, 0, TAU);
      paint(ctx, null, 1.4, '#c98a1f');
      ctx.fillStyle = '#c98a1f';
      for (const [hx, hy] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) {
        ctx.beginPath();
        ctx.arc(hx, hy, 2.8, 0, TAU);
        ctx.fill();
      }
      break;
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- big food
export type FoodKind = 'melon' | 'donut' | 'cookie' | 'cheese';

export function drawFood(ctx: C, kind: FoodKind, x: number, y: number, r: number, t: number, happy: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  ctx.beginPath();
  ctx.ellipse(4, r * 0.75, r * 1.05, r * 0.4, 0, 0, TAU);
  ctx.fill();
  const sq = 1 + Math.sin(t * 3) * 0.03;
  ctx.scale(sq, 2 - sq);
  switch (kind) {
    case 'melon': {
      ctx.beginPath();
      ctx.moveTo(-r * 1.1, -r * 0.4);
      ctx.quadraticCurveTo(0, r * 1.5, r * 1.1, -r * 0.4);
      ctx.closePath();
      paint(ctx, '#5cc46a', 2.6);
      ctx.beginPath();
      ctx.moveTo(-r * 0.95, -r * 0.4);
      ctx.quadraticCurveTo(0, r * 1.2, r * 0.95, -r * 0.4);
      ctx.closePath();
      paint(ctx, '#ff6b7f', 0);
      ctx.fillStyle = INK;
      for (const [sx, sy] of [[-0.5, 0], [0.5, 0], [0, 0.35], [-0.25, 0.25], [0.25, 0.25]]) {
        ctx.beginPath();
        ctx.ellipse(sx * r, sy * r, 2.2, 3.4, 0, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'donut': {
      blob(ctx, 0, 0, r, r * 0.92, 5, 0.03);
      paint(ctx, '#e3a35f', 2.6);
      blob(ctx, 0, -2, r * 0.86, r * 0.78, 6, 0.08);
      paint(ctx, '#ff9fd0', 2);
      ctx.beginPath();
      ctx.ellipse(0, -2, r * 0.3, r * 0.26, 0, 0, TAU);
      paint(ctx, '#e3a35f', 2);
      const sp = ['#fff', '#7ed6ff', '#ffd166', '#b5f27a'];
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU;
        const rr = r * (0.5 + (i % 3) * 0.1);
        ctx.save();
        ctx.translate(Math.cos(a) * rr, Math.sin(a) * rr * 0.9 - 2);
        ctx.rotate(a * 3);
        ctx.fillStyle = sp[i % 4];
        ctx.fillRect(-3, -1, 6, 2);
        ctx.restore();
      }
      break;
    }
    case 'cookie': {
      blob(ctx, 0, 0, r, r, 8, 0.05);
      paint(ctx, '#e8b56b', 2.6);
      ctx.fillStyle = '#6b4226';
      for (let i = 0; i < 7; i++) {
        const a = i * 2.4;
        blob(ctx, Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, 4, 3.5, i, 0.1);
        ctx.fill();
      }
      break;
    }
    case 'cheese': {
      ctx.beginPath();
      ctx.moveTo(-r, r * 0.6);
      ctx.lineTo(r, r * 0.6);
      ctx.lineTo(r * 0.8, -r * 0.7);
      ctx.closePath();
      paint(ctx, '#ffd84d', 2.6);
      ctx.fillStyle = '#f0b72f';
      for (const [hx, hy, hr] of [[0.2, 0.2, 0.15], [0.55, -0.2, 0.1], [-0.3, 0.42, 0.1]]) {
        ctx.beginPath();
        ctx.arc(hx * r, hy * r, hr * r, 0, TAU);
        ctx.fill();
      }
      break;
    }
  }
  // kawaii face
  const fy = kind === 'melon' ? -r * 0.05 : kind === 'cheese' ? r * 0.25 : 0;
  const fx = kind === 'cheese' ? r * 0.15 : 0;
  if (happy) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(fx + s * r * 0.28, fy, 4, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
  } else {
    eye(ctx, fx - r * 0.28, fy, 5, Math.sin(t), 0, 1.4);
    eye(ctx, fx + r * 0.28, fy, 5, Math.sin(t), 0, 1.4);
  }
  cheeks(ctx, fx, fy + 8, r * 0.42, 4);
  smile(ctx, fx, fy + 10, 4, 1.6, happy);
  ctx.restore();
}

// ---------------------------------------------------------------- the foot
export function drawFootShadow(ctx: C, x: number, y: number, r: number, k: number) {
  ctx.fillStyle = `rgba(40,20,60,${0.1 + k * 0.25})`;
  ctx.beginPath();
  ctx.ellipse(x, y, r * (0.5 + k * 0.5), r * 1.3 * (0.5 + k * 0.5), 0, 0, TAU);
  ctx.fill();
  ctx.setLineDash([8, 8]);
  ctx.lineDashOffset = -k * 40;
  ctx.strokeStyle = 'rgba(239,75,95,0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 1.3, 0, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Giant sock + sneaker sole seen from above. h = height (0 = on ground, 1 = high). */
export function drawFoot(ctx: C, x: number, y: number, r: number, h: number) {
  const s = 1 + h * 0.6;
  ctx.save();
  ctx.translate(x, y - h * 30);
  ctx.scale(s, s);
  ctx.globalAlpha = 1 - h * 0.3;
  blob(ctx, 0, 0, r * 0.95, r * 1.35, 21, 0.03);
  paint(ctx, '#f7f1ff', 3);
  blob(ctx, 0, -r * 0.2, r * 0.75, r * 0.95, 22, 0.04);
  paint(ctx, '#9b8cff', 2.2);
  ctx.strokeStyle = '#7a6be0';
  ctx.lineWidth = 3;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, i * r * 0.25);
    ctx.lineTo(r * 0.6, i * r * 0.25 + 6);
    ctx.stroke();
  }
  ctx.fillStyle = '#ff7eb6';
  ctx.beginPath();
  ctx.arc(0, r * 0.9, r * 0.22, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- bosses
export interface BossVisual {
  hurt: number; // 0..1 flash
  attack: number; // 0..1 lunge
  dead: boolean;
  rage: boolean; // below half HP: steaming mad and attacking faster
}

export function drawBoss(ctx: C, kind: BossKind, x: number, y: number, t: number, v: BossVisual) {
  ctx.save();
  const angry = v.rage && !v.dead;
  ctx.translate(x + (angry ? Math.sin(t * 40) * 1.5 : 0), y + v.attack * 26);
  const sx = 1 + Math.sin(t * 3) * 0.03 + v.hurt * 0.08;
  ctx.scale(sx, 2 - sx);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(0, 50, 90, 26, 0, 0, TAU);
  ctx.fill();
  const tint = (c: string) => (v.hurt > 0.8 ? '#fff0f5' : c);
  const deadEyes = () => {
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    return (ex: number, ey: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(ex - r, ey - r);
      ctx.lineTo(ex + r, ey + r);
      ctx.moveTo(ex + r, ey - r);
      ctx.lineTo(ex - r, ey + r);
      ctx.stroke();
    };
  };
  const bigEye = (ex: number, ey: number, r: number) => {
    if (v.dead) deadEyes()(ex, ey, r * 0.6);
    else eye(ctx, ex, ey, r, Math.sin(t * 1.3) * 0.6, 0.6, 2);
  };
  switch (kind) {
    case 'spider': {
      ctx.lineWidth = 5;
      ctx.strokeStyle = INK;
      ctx.lineCap = 'round';
      for (const side of [-1, 1]) {
        for (let k = 0; k < 4; k++) {
          const w = Math.sin(t * 6 + k + side) * 6;
          const a = -0.9 + k * 0.55;
          const kx = side * (55 + Math.cos(a) * 30);
          const ky = Math.sin(a) * 50 + w;
          ctx.beginPath();
          ctx.moveTo(side * 25, k * 8 - 10);
          ctx.quadraticCurveTo(kx, ky - 40, side * (95 + k * 4), ky + 25 + v.attack * 10);
          ctx.stroke();
        }
      }
      blob(ctx, 0, -28, 50, 46, 30, 0.06);
      paint(ctx, tint('#8e6cc8'), 3);
      // fuzzy stripes
      ctx.strokeStyle = '#6a4ca6';
      ctx.lineWidth = 6;
      for (const r of [22, 36]) {
        ctx.beginPath();
        ctx.arc(0, -28, r, 1.15 * Math.PI, 1.85 * Math.PI);
        ctx.stroke();
      }
      blob(ctx, 0, 18, 34, 28, 31, 0.05);
      paint(ctx, tint('#a88ae0'), 3);
      bigEye(-13, 14, 9);
      bigEye(13, 14, 9);
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(s * 25, 4, 4.5, 0, TAU);
        paint(ctx, '#fff', 1.6);
      }
      ctx.fillStyle = INK;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * 6, 36);
        ctx.lineTo(s * 10, 48 + v.attack * 6);
        ctx.lineTo(s * 13, 36);
        ctx.fill();
      }
      // tiny bow
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(-14, -18);
      ctx.lineTo(-14, 2);
      ctx.closePath();
      ctx.moveTo(0, -8);
      ctx.lineTo(14, -18);
      ctx.lineTo(14, 2);
      ctx.closePath();
      paint(ctx, '#ff7eb6', 2);
      break;
    }
    case 'frog': {
      for (const s of [-1, 1]) {
        blob(ctx, s * 62, 30, 22, 14, 40 + s, 0.08, s * 0.4);
        paint(ctx, tint('#5cc46a'), 2.6);
      }
      blob(ctx, 0, 0, 72, 58, 41, 0.05);
      paint(ctx, tint('#7bd88f'), 3);
      ctx.fillStyle = '#5cb06b';
      for (const [px, py, pr] of [[-30, -20, 9], [28, -30, 7], [40, 0, 6], [-45, 10, 5]]) {
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, TAU);
        ctx.fill();
      }
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(s * 30, 22, 17, 0, TAU);
        paint(ctx, tint('#7bd88f'), 3);
        bigEye(s * 30, 22, 12);
      }
      // mouth + tongue
      ctx.beginPath();
      ctx.arc(0, 40, 26, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.lineWidth = 3;
      ctx.strokeStyle = INK;
      ctx.stroke();
      if (v.attack > 0.05) {
        ctx.beginPath();
        ctx.moveTo(0, 60);
        ctx.lineTo(0, 60 + v.attack * 120);
        ctx.lineWidth = 9;
        ctx.strokeStyle = '#ff6b81';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 60 + v.attack * 120, 11, 0, TAU);
        paint(ctx, '#ff6b81', 2);
      }
      cheeks(ctx, 0, 40, 50, 9);
      break;
    }
    case 'lizard': {
      const wag = Math.sin(t * 4) * 0.5;
      ctx.beginPath();
      ctx.moveTo(-12, -40);
      ctx.quadraticCurveTo(40 * wag, -110, -60 * wag, -150);
      ctx.quadraticCurveTo(10 * wag, -100, 12, -40);
      ctx.closePath();
      paint(ctx, tint('#ffb14e'), 3);
      for (const [lx, ly, s] of [[-40, -30, -1], [40, -30, 1], [-42, 30, -1], [42, 30, 1]]) {
        blob(ctx, lx, ly + Math.sin(t * 6 + lx) * 4, 16, 9, lx, 0.1, s * 0.3);
        paint(ctx, tint('#ff9a3c'), 2.4);
      }
      blob(ctx, 0, -5, 34, 58, 50, 0.05);
      paint(ctx, tint('#ffb14e'), 3);
      ctx.fillStyle = '#ff8a3d';
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(0, -45 + i * 16, 5, 0, TAU);
        ctx.fill();
      }
      blob(ctx, 0, 52, 30, 26, 51, 0.05);
      paint(ctx, tint('#ffc46e'), 3);
      bigEye(-17, 50, 10);
      bigEye(17, 50, 10);
      if (v.attack > 0.05) {
        ctx.beginPath();
        ctx.moveTo(0, 76);
        ctx.lineTo(-4, 76 + v.attack * 50);
        ctx.moveTo(0, 76);
        ctx.lineTo(4, 76 + v.attack * 50);
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#ff4d6d';
        ctx.stroke();
      }
      cheeks(ctx, 0, 66, 18, 5);
      break;
    }
    case 'mantis': {
      const sway = Math.sin(t * 2.2) * 5;
      // long abdomen and folded wings, pointing away from the ants
      blob(ctx, 0, -60, 25, 52, 70, 0.05);
      paint(ctx, tint('#7cc46a'), 3);
      ctx.strokeStyle = '#5ea24f';
      ctx.lineWidth = 3;
      for (const yy of [-92, -74, -56, -38]) {
        ctx.beginPath();
        ctx.moveTo(-19, yy);
        ctx.quadraticCurveTo(0, yy + 7, 19, yy);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.6;
      for (const s of [-1, 1]) {
        blob(ctx, s * 11, -52, 15, 44, 71 + s, 0.04, s * 0.15);
        paint(ctx, '#ecffe0', 2, '#5ea24f');
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      for (const s of [-1, 1]) {
        for (let k = 0; k < 2; k++) {
          const w = Math.sin(t * 6 + k * 2 + s) * 5;
          ctx.beginPath();
          ctx.moveTo(s * 10, -18 + k * 16);
          ctx.lineTo(s * 52, -42 + k * 30 + w);
          ctx.lineTo(s * 74, -8 + k * 32 + w);
          ctx.stroke();
        }
      }
      blob(ctx, 0, 2, 15, 32, 72, 0.05);
      paint(ctx, tint('#8fd16a'), 3);
      // praying scythe arms: raised high, chopping down on attack
      const limb = (pts: number[], w: number, col: string) => {
        ctx.beginPath();
        ctx.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = INK;
        ctx.lineWidth = w + 5;
        ctx.stroke();
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.stroke();
      };
      for (const s of [-1, 1]) {
        const ex = s * 60;
        const ey = -16 + sway * s;
        const tx = s * (56 - v.attack * 14);
        const ty = 34 + v.attack * 50;
        limb([s * 12, 14, ex, ey], 9, tint('#8fd16a'));
        limb([ex, ey, tx, ty], 8, tint('#b5f27a'));
        ctx.fillStyle = INK;
        for (let k = 1; k <= 3; k++) {
          const px = ex + (tx - ex) * (k / 4);
          const py = ey + (ty - ey) * (k / 4);
          ctx.beginPath();
          ctx.moveTo(px - s * 3, py - 4);
          ctx.lineTo(px - s * 12, py);
          ctx.lineTo(px - s * 3, py + 4);
          ctx.fill();
        }
      }
      // antennae
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * 6, 24);
        ctx.quadraticCurveTo(s * 18, -6, s * (34 + Math.sin(t * 5 + s) * 4), -14);
        ctx.stroke();
      }
      // triangle head with bulging eyes and a kung-fu headband
      ctx.beginPath();
      ctx.moveTo(-36, 30);
      ctx.quadraticCurveTo(0, 16, 36, 30);
      ctx.quadraticCurveTo(16, 64, 0, 72);
      ctx.quadraticCurveTo(-16, 64, -36, 30);
      ctx.closePath();
      paint(ctx, tint('#a6e07a'), 3);
      const wave = Math.sin(t * 10) * 4;
      limb([-30, 37, 30, 37], 5, '#ef4b5f');
      limb([30, 37, 44, 46 + wave, 56, 40 - wave], 4, '#ef4b5f');
      bigEye(-27, 31, 11);
      bigEye(27, 31, 11);
      cheeks(ctx, 0, 52, 14, 4);
      ctx.beginPath();
      ctx.moveTo(-5, 61);
      ctx.lineTo(0, 64 + v.attack * 4);
      ctx.lineTo(5, 61);
      paint(ctx, null, 2);
      break;
    }
    case 'bee': {
      const flap = Math.sin(t * 30);
      ctx.globalAlpha = 0.65;
      for (const s of [-1, 1]) {
        blob(ctx, s * 60, -46, 44, 25 * (0.75 + flap * 0.25), 80 + s, 0.04, s * -0.5);
        paint(ctx, '#eef9ff', 2.4, '#7fb2d9');
        blob(ctx, s * 50, -6, 30, 17 * (0.75 - flap * 0.25), 82 + s, 0.04, s * -0.2);
        paint(ctx, '#eef9ff', 2.4, '#7fb2d9');
      }
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(-8, -86);
      ctx.lineTo(0, -110 - v.attack * 12);
      ctx.lineTo(8, -86);
      ctx.closePath();
      paint(ctx, '#3a2d45', 2);
      // striped fuzzy abdomen
      blob(ctx, 0, -40, 50, 52, 83, 0.04);
      paint(ctx, tint('#ffd23f'), 0);
      ctx.save();
      blob(ctx, 0, -40, 50, 52, 83, 0.04);
      ctx.clip();
      ctx.fillStyle = '#3a2d45';
      for (const yy of [-80, -54, -28]) ctx.fillRect(-60, yy, 120, 13);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(-22, -58, 9, 16, -0.4, 0, TAU);
      ctx.fill();
      ctx.restore();
      blob(ctx, 0, -40, 50, 52, 83, 0.04);
      paint(ctx, null, 3);
      blob(ctx, 0, 10, 34, 20, 84, 0.12, 0, 16);
      paint(ctx, tint('#fff1c2'), 2.6);
      // tiny arms waving a honey dipper
      ctx.save();
      ctx.translate(38, 22);
      ctx.rotate(-0.5 + Math.sin(t * 4) * 0.3 + v.attack * 0.8);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -34);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#a8743a';
      ctx.stroke();
      blob(ctx, 0, -40, 8, 10, 86, 0.05);
      paint(ctx, '#ffb84d', 2);
      ctx.strokeStyle = '#c98a1f';
      ctx.lineWidth = 1.5;
      for (const yy of [-44, -40, -36]) {
        ctx.beginPath();
        ctx.moveTo(-7, yy);
        ctx.lineTo(7, yy);
        ctx.stroke();
      }
      ctx.restore();
      // antennae
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.4;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * 10, 18);
        ctx.quadraticCurveTo(s * 18, 2, s * 26, 6 + Math.sin(t * 6 + s) * 3);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(s * 26, 6 + Math.sin(t * 6 + s) * 3, 3.5, 0, TAU);
        paint(ctx, '#3a2d45', 1.6);
      }
      blob(ctx, 0, 42, 32, 28, 85, 0.04);
      paint(ctx, tint('#ffd23f'), 3);
      bigEye(-12, 40, 9);
      bigEye(12, 40, 9);
      // grumpy brows + frown
      ctx.beginPath();
      ctx.moveTo(-21, 27);
      ctx.lineTo(-6, 31);
      ctx.moveTo(21, 27);
      ctx.lineTo(6, 31);
      ctx.lineWidth = 3;
      ctx.strokeStyle = INK;
      ctx.stroke();
      cheeks(ctx, 0, 54, 20, 5);
      ctx.beginPath();
      ctx.arc(0, 64, 6, 1.15 * Math.PI, 1.85 * Math.PI);
      paint(ctx, null, 2.2);
      // tiara
      ctx.beginPath();
      ctx.moveTo(-14, 18);
      ctx.lineTo(-16, 4);
      ctx.lineTo(-7, 11);
      ctx.lineTo(0, 0);
      ctx.lineTo(7, 11);
      ctx.lineTo(16, 4);
      ctx.lineTo(14, 18);
      ctx.closePath();
      paint(ctx, '#ffe8a3', 2);
      ctx.beginPath();
      ctx.arc(0, 11, 2.5, 0, TAU);
      ctx.fillStyle = '#ff7eb6';
      ctx.fill();
      break;
    }
    case 'beetleKing': {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5;
      for (const side of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.moveTo(side * 40, -20 + k * 26);
          ctx.lineTo(side * 85, -30 + k * 30 + Math.sin(t * 7 + k) * 6 * side);
          ctx.stroke();
        }
      }
      blob(ctx, 0, -10, 62, 66, 60, 0.04);
      paint(ctx, tint('#3d7be0'), 3);
      ctx.beginPath();
      ctx.moveTo(0, -74);
      ctx.lineTo(0, 50);
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(-25, -35, 12, 22, -0.3, 0, TAU);
      ctx.fill();
      blob(ctx, 0, 50, 40, 30, 61, 0.05);
      paint(ctx, tint('#2a5bb3'), 3);
      // horn
      ctx.beginPath();
      ctx.moveTo(-10, 70);
      ctx.quadraticCurveTo(0, 110 + v.attack * 30, 22, 112 + v.attack * 30);
      ctx.quadraticCurveTo(8, 92, 10, 70);
      ctx.closePath();
      paint(ctx, '#ffd166', 2.6);
      bigEye(-17, 44, 9);
      bigEye(17, 44, 9);
      // crown
      ctx.beginPath();
      ctx.moveTo(-22, 26);
      ctx.lineTo(-26, 2);
      ctx.lineTo(-12, 14);
      ctx.lineTo(0, -2);
      ctx.lineTo(12, 14);
      ctx.lineTo(26, 2);
      ctx.lineTo(22, 26);
      ctx.closePath();
      paint(ctx, '#ffd166', 2.4);
      break;
    }
  }
  if (angry) {
    // throbbing anger mark and puffs of steam
    ctx.font = `${30 + Math.sin(t * 12) * 4}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💢', 62, -58);
    for (let i = 0; i < 2; i++) {
      const k = (t * 1.6 + i * 0.5) % 1;
      ctx.globalAlpha = 0.7 * (1 - k);
      ctx.beginPath();
      ctx.arc((i ? 1 : -1) * (46 + k * 18), -70 - k * 50, 9 + k * 10, 0, TAU);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ---------------------------------------------------------------- background
export const TRACK_HALF = 200;

function hash2(a: number, b: number) {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Draw the themed ground. top/bottom are world-y bounds (screen space, y down), sideW = half visible width. */
export function drawGround(ctx: C, theme: ThemeDef, themeIdx: number, camD: number, top: number, bottom: number, sideW: number) {
  const T = 50;
  // World y on screen is -(d - camD); tiles are aligned to d.
  const dTop = camD - top;
  const dBot = camD - bottom;
  ctx.fillStyle = theme.side;
  ctx.fillRect(-sideW, top, sideW * 2, bottom - top);
  // side decoration
  for (let d = Math.floor(dBot / 60) * 60; d < dTop + 60; d += 60) {
    for (let col = -Math.ceil(sideW / 60); col <= Math.ceil(sideW / 60); col++) {
      const cx = col * 60 + 30;
      if (Math.abs(cx) < TRACK_HALF + 20) continue;
      const r = hash2(d, col);
      const px = cx + (hash2(col, d) - 0.5) * 30;
      const py = -(d - camD) + (r - 0.5) * 30;
      drawSideDecor(ctx, themeIdx, px, py, r);
    }
  }
  ctx.fillStyle = theme.bg;
  ctx.fillRect(-TRACK_HALF, top, TRACK_HALF * 2, bottom - top);
  const d0 = Math.floor(dBot / T) * T;
  ctx.fillStyle = theme.bg2;
  switch (themeIdx) {
    case 0: // checkered picnic blanket
      for (let d = d0; d < dTop + T; d += T) {
        for (let c = 0; c < 8; c++) {
          if ((((c + d / T) % 2) + 2) % 2 === 0) ctx.fillRect(-TRACK_HALF + c * T, -(d - camD) - T, T, T);
        }
      }
      ctx.strokeStyle = 'rgba(226,120,138,0.35)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      for (let c = 1; c < 8; c++) {
        ctx.beginPath();
        ctx.moveTo(-TRACK_HALF + c * T - T / 2, top);
        ctx.lineTo(-TRACK_HALF + c * T - T / 2, bottom);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      break;
    case 1: // kitchen tiles
      ctx.strokeStyle = theme.bg2;
      ctx.lineWidth = 4;
      for (let d = d0; d < dTop + T; d += T) {
        ctx.beginPath();
        ctx.moveTo(-TRACK_HALF, -(d - camD));
        ctx.lineTo(TRACK_HALF, -(d - camD));
        ctx.stroke();
      }
      for (let c = 1; c < 8; c++) {
        ctx.beginPath();
        ctx.moveTo(-TRACK_HALF + c * T, top);
        ctx.lineTo(-TRACK_HALF + c * T, bottom);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (let d = d0; d < dTop + T; d += T * 2) {
        for (let c = 0; c < 8; c += 3) ctx.fillRect(-TRACK_HALF + c * T + 8, -(d - camD) - T + 8, 10, 4);
      }
      break;
    case 2: // garden soil with pebbles
      for (let d = d0; d < dTop + T; d += T) {
        for (let c = 0; c < 8; c++) {
          const r = hash2(d, c);
          if (r < 0.5) continue;
          ctx.fillStyle = r > 0.8 ? '#b39168' : theme.bg2;
          ctx.beginPath();
          ctx.ellipse(-TRACK_HALF + c * T + r * 40, -(d - camD) - r * 40, 4 + r * 5, 3 + r * 3, r * 3, 0, TAU);
          ctx.fill();
        }
      }
      break;
    case 3: // wooden planks
      ctx.strokeStyle = theme.bg2;
      ctx.lineWidth = 3;
      for (let c = 0; c <= 5; c++) {
        const px = -TRACK_HALF + c * 80;
        ctx.beginPath();
        ctx.moveTo(px, top);
        ctx.lineTo(px, bottom);
        ctx.stroke();
      }
      ctx.lineWidth = 1.5;
      for (let d = Math.floor(dBot / 120) * 120; d < dTop + 120; d += 120) {
        for (let c = 0; c < 5; c++) {
          const r = hash2(d, c);
          const py = -(d - camD) - r * 120;
          ctx.beginPath();
          ctx.moveTo(-TRACK_HALF + c * 80 + 4, py);
          ctx.lineTo(-TRACK_HALF + c * 80 + 76, py);
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(-TRACK_HALF + c * 80 + 20 + r * 40, py + 30, 6, 10, 0, 0, TAU);
          ctx.stroke();
        }
      }
      break;
    case 4: // candy stripes + sprinkles
      ctx.fillStyle = theme.bg2;
      for (let d = Math.floor(dBot / 80) * 80; d < dTop + 80; d += 80) {
        ctx.fillRect(-TRACK_HALF, -(d - camD) - 40, TRACK_HALF * 2, 40);
      }
      for (let d = d0; d < dTop + T; d += T) {
        for (let c = 0; c < 8; c++) {
          const r = hash2(d, c);
          ctx.save();
          ctx.translate(-TRACK_HALF + c * T + r * 40, -(d - camD) - r * 37);
          ctx.rotate(r * 6);
          ctx.fillStyle = CANDY[Math.floor(r * 4)];
          ctx.fillRect(-4, -1.5, 8, 3);
          ctx.restore();
        }
      }
      break;
    case 5: // bathroom: little square tiles and soap bubbles
      ctx.strokeStyle = theme.bg2;
      ctx.lineWidth = 3;
      for (let d = Math.floor(dBot / 25) * 25; d < dTop + 25; d += 25) {
        ctx.beginPath();
        ctx.moveTo(-TRACK_HALF, -(d - camD));
        ctx.lineTo(TRACK_HALF, -(d - camD));
        ctx.stroke();
      }
      for (let c = 1; c < 16; c++) {
        ctx.beginPath();
        ctx.moveTo(-TRACK_HALF + c * 25, top);
        ctx.lineTo(-TRACK_HALF + c * 25, bottom);
        ctx.stroke();
      }
      ctx.lineWidth = 1.5;
      for (let d = d0; d < dTop + T; d += T) {
        for (let c = 0; c < 8; c++) {
          const r = hash2(d, c);
          if (r < 0.75) continue;
          const bx = -TRACK_HALF + c * T + r * 40;
          const by = -(d - camD) - r * 40;
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.strokeStyle = 'rgba(120,190,230,0.8)';
          ctx.beginPath();
          ctx.arc(bx, by, 4 + r * 7, 0, TAU);
          ctx.fill();
          ctx.stroke();
        }
      }
      break;
    case 6: // fridge: wire shelf bars and frost
      ctx.strokeStyle = theme.bg2;
      ctx.lineWidth = 6;
      for (let d = Math.floor(dBot / 40) * 40; d < dTop + 40; d += 40) {
        ctx.beginPath();
        ctx.moveTo(-TRACK_HALF, -(d - camD));
        ctx.lineTo(TRACK_HALF, -(d - camD));
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      for (let d = d0; d < dTop + T; d += T) {
        for (let c = 0; c < 8; c++) {
          const r = hash2(d, c);
          if (r < 0.7) continue;
          const fx = -TRACK_HALF + c * T + r * 40;
          const fy = -(d - camD) - r * 40;
          for (let k = 0; k < 3; k++) {
            const a = (k / 3) * Math.PI;
            ctx.beginPath();
            ctx.moveTo(fx - Math.cos(a) * 6, fy - Math.sin(a) * 6);
            ctx.lineTo(fx + Math.cos(a) * 6, fy + Math.sin(a) * 6);
            ctx.stroke();
          }
        }
      }
      break;
    case 7: // schoolyard running track with chalk lanes
      ctx.strokeStyle = theme.bg2;
      ctx.lineWidth = 4;
      for (let c = 1; c < 5; c++) {
        ctx.beginPath();
        ctx.moveTo(-TRACK_HALF + c * 80, top);
        ctx.lineTo(-TRACK_HALF + c * 80, bottom);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let d = Math.floor(dBot / 160) * 160; d < dTop + 160; d += 160) {
        for (let c = 0; c < 5; c++) {
          const r = hash2(d, c);
          if (r < 0.6) continue;
          ctx.font = '800 22px "Baloo 2", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(String(1 + Math.floor(r * 9)), -TRACK_HALF + c * 80 + 40, -(d - camD) - r * 120);
        }
      }
      break;
  }
  // wobbly edges
  for (const s of [-1, 1]) {
    ctx.beginPath();
    for (let y = top - 20; y <= bottom + 20; y += 20) {
      const d = camD - y;
      const wx = s * TRACK_HALF + Math.sin(d * 0.05) * 2;
      if (y === top - 20) ctx.moveTo(wx, y);
      else ctx.lineTo(wx, y);
    }
    ctx.lineWidth = 5;
    ctx.strokeStyle = theme.edge;
    ctx.stroke();
  }
}

function drawSideDecor(ctx: C, theme: number, x: number, y: number, r: number) {
  if (r < 0.35) return;
  if (theme === 0 || theme === 2 || theme === 7) {
    if (r > 0.75) {
      // flower
      const col = ['#ff9fd0', '#ffd166', '#fff', '#c7b3ff'][Math.floor(r * 40) % 4];
      ctx.fillStyle = col;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * 6, y + Math.sin(a) * 6, 5, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#ffb703';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, TAU);
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(40,90,40,0.35)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x - 6, y + 5);
      ctx.lineTo(x - 3, y - 6);
      ctx.moveTo(x, y + 5);
      ctx.lineTo(x + 1, y - 9);
      ctx.moveTo(x + 6, y + 5);
      ctx.lineTo(x + 5, y - 5);
      ctx.stroke();
    }
  } else if (theme === 6) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI + r;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(a) * 7, y - Math.sin(a) * 7);
      ctx.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7);
      ctx.stroke();
    }
  } else if (theme === 4 || theme === 5) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(x, y, 3 + r * 6, 0, TAU);
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(x, y, 2 + r * 4, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 12, y + 8, 1.5 + r * 2, 0, TAU);
    ctx.fill();
  }
}

// ---------------------------------------------------------------- slippery puddle & desk fan
export function drawPuddle(ctx: C, x: number, y: number, rx: number, ry: number, seed: number, t: number) {
  blob(ctx, x, y, rx, ry, seed, 0.1, 0, 14);
  paint(ctx, 'rgba(126,200,255,0.55)', 2.4, '#4a9fd8');
  blob(ctx, x - rx * 0.3, y - ry * 0.25, rx * 0.35, ry * 0.18, seed + 3, 0.1, -0.2, 10);
  paint(ctx, 'rgba(255,255,255,0.65)', 0);
  // ripples
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 2; i++) {
    const k = (t * 0.6 + i * 0.5) % 1;
    ctx.globalAlpha = 1 - k;
    ctx.beginPath();
    ctx.ellipse(x + rx * 0.25, y + ry * 0.2, 6 + k * rx * 0.4, 3 + k * ry * 0.3, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** A desk fan parked at the edge of the track, blowing towards the other side. */
export function drawFan(ctx: C, x: number, y: number, side: number, t: number) {
  ctx.save();
  ctx.translate(x, y);
  // stand
  rrect(ctx, -8, 18, 16, 30, 4, 7, 0.4);
  paint(ctx, '#9aa7b8');
  blob(ctx, 0, 48, 26, 9, 9, 0.05);
  paint(ctx, '#7d8899');
  // cage + blades
  blob(ctx, 0, 0, 34, 34, 11, 0.04);
  paint(ctx, '#e8f4ff');
  ctx.save();
  ctx.rotate(t * 18 * -side);
  for (let i = 0; i < 3; i++) {
    ctx.rotate(TAU / 3);
    blob(ctx, 14, 0, 14, 7, 20 + i, 0.08, 0.3);
    paint(ctx, '#7ed6ff', 1.8);
  }
  ctx.restore();
  blob(ctx, 0, 0, 7, 7, 30, 0.05);
  paint(ctx, '#ff7eb6', 1.8);
  ctx.strokeStyle = 'rgba(43,34,51,0.35)';
  ctx.lineWidth = 1.5;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 12, -32);
    ctx.lineTo(i * 12, 32);
    ctx.stroke();
  }
  ctx.restore();
}

/** Gusts streaking across the track between y0 and y1 (screen space), blowing in direction `dir`. */
export function drawWind(ctx: C, y0: number, y1: number, dir: number, t: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineCap = 'round';
  ctx.lineWidth = 3;
  const span = TRACK_HALF * 2 + 120;
  for (let i = 0; i < 9; i++) {
    const y = y0 + ((i * 0.618) % 1) * (y1 - y0);
    const p = ((t * 0.9 + i * 0.37) % 1) * span - span / 2;
    const x = p * dir;
    ctx.globalAlpha = 0.35 + 0.4 * Math.sin(((t * 0.9 + i * 0.37) % 1) * Math.PI);
    ctx.beginPath();
    ctx.moveTo(x - 30 * dir, y);
    ctx.quadraticCurveTo(x, y - 6, x + 30 * dir, y);
    ctx.stroke();
  }
  ctx.restore();
}
