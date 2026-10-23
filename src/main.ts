import './style.css';
import { drawAccessory, drawAnt, drawCrumb, drawGround, makeAntSprites, setBoil, type AntSprites } from './art';
import { Sound } from './audio';
import { CAPTAINS, THEMES, UPGRADES, upgradeCost, type CaptainId } from './data';
import { Run, type RunResult, type RunStats } from './game';
import { getLang, setLang, t, tr } from './i18n';
import { generateLevel } from './level';
import { hashString } from './rng';
import { loadSave, resetSave, todayKey, writeSave } from './save';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const ui = document.getElementById('ui')!;

let save = loadSave();
setLang(save.lang);
const sound = new Sound();
sound.sfxOn = save.sfx;
sound.musicOn = save.music;

let W = 0;
let H = 0;
let dpr = 1;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
}
window.addEventListener('resize', resize);
resize();

let run: Run | null = null;
let runIsDaily = false;

// ------------------------------------------------------------------ helpers
function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, any> = {}, ...kids: (Node | string)[]) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else (el as any)[k] = v;
  }
  for (const c of kids) el.append(c);
  return el;
}

function btn(label: string, cls: string, onClick: () => void) {
  return h('button', {
    class: `btn ${cls}`,
    innerHTML: label,
    onclick: (e: Event) => {
      e.stopPropagation();
      sound.unlock();
      sound.click();
      onClick();
    },
  });
}

function show(...els: HTMLElement[]) {
  ui.replaceChildren(...els);
}

function toast(msg: string) {
  const el = h('div', { class: 'toast', textContent: msg });
  ui.append(el);
  setTimeout(() => el.remove(), 1400);
}

const honeyPill = () => h('div', { class: 'honey-pill', textContent: `🍯 ${save.honey}` });
const persist = () => writeSave(save);
const fmt = (n: number) => n.toLocaleString(getLang() === 'vi' ? 'vi-VN' : 'en-US');

function stats(): RunStats {
  const u = save.upgrades;
  const c = save.captain;
  return {
    startAnts: 8 + u.colony * 2 + (c === 'hat' ? 4 : 0),
    power: 1 + u.power * 0.1 + (c === 'knight' ? 0.3 : 0),
    magnet: (6 + u.magnet * 7) * (c === 'astro' ? 1.6 : 1),
    // ants bounce off hazards 15% of the time even without upgrades
    dodge: Math.min(0.85, 0.15 + u.armor * 0.04 + (c === 'ninja' ? 0.2 : 0)),
    honeyMult: 1 + u.honey * 0.1 + (c === 'king' ? 0.3 : 0),
    plusBoost: c === 'chubby' ? 1.25 : 1,
    crumbHoneyMult: c === 'dj' ? 2 : 1,
    captain: c,
  };
}

// ------------------------------------------------------------------ screens
function menuScreen() {
  run = null;
  sound.setMusic('menu');
  const other = getLang() === 'vi' ? 'Ant Rumble!' : 'Kiến Ơi Kiến Ầm!';
  const titleText = t('title');
  const title = h('h1', { class: 'title' });
  [...titleText].forEach((ch, i) => {
    const s = h('span', { textContent: ch === ' ' ? ' ' : ch });
    s.style.animationDelay = `${i * 0.07}s`;
    title.append(s);
  });
  const best = save.daily[todayKey()];
  show(
    honeyPill(),
    h('div', { class: 'screen' },
      title,
      h('div', { class: 'subtitle', textContent: other }),
      h('div', { class: 'tagline', textContent: t('tagline') }),
      h('div', { style: 'height:8px' }),
      btn(`▶ ${t('play')} · ${t('level')} ${save.level}`, 'big', () => startRun(false)),
      btn(`📅 ${t('daily')}${best ? `<span class="best">&nbsp;(${t('dailyBest')}: ${fmt(best)})</span>` : ''}`, 'sky', () => startRun(true)),
      h('div', { class: 'row' },
        btn(`🏠 ${t('nest')}`, 'pink', nestScreen),
        btn(`🐜 ${t('colony')}`, 'grape', collectionScreen),
      ),
      h('div', { class: 'row' }, btn('⚙️', 'white icon-btn', settingsScreen)),
    ),
    h('div', { class: 'version', textContent: 'v1.0' }),
  );
}

function nestScreen() {
  const list = h('div', { class: 'list' });
  for (const u of UPGRADES) {
    const lvl = save.upgrades[u.id];
    const maxed = lvl >= u.max;
    const cost = upgradeCost(u, lvl);
    const pips = h('div', { class: 'pips' });
    for (let i = 0; i < u.max; i++) pips.append(h('div', { class: `pip${i < lvl ? ' on' : ''}` }));
    const buy = btn(maxed ? t('max') : `🍯 ${fmt(cost)}`, 'small', () => {
      if (maxed) return;
      if (save.honey < cost) {
        sound.nope();
        toast(t('notEnough'));
        return;
      }
      save.honey -= cost;
      save.upgrades[u.id]++;
      persist();
      sound.buy();
      nestScreen();
    });
    if (maxed) buy.disabled = true;
    list.append(
      h('div', { class: 'item' },
        h('div', { class: 'ico', textContent: u.icon }),
        h('div', { class: 'info' },
          h('div', { class: 'name', textContent: `${tr(u.name)} · ${t('lv')} ${lvl}` }),
          h('div', { class: 'desc', textContent: tr(u.desc) }),
          pips,
        ),
        buy,
      ),
    );
  }
  show(honeyPill(), h('div', { class: 'screen' }, h('div', { class: 'panel' }, h('h2', { textContent: `🏠 ${t('nest')}` }), list, h('div', { class: 'center' }, btn(`↩ ${t('back')}`, 'white', menuScreen)))));
}

const previewSprites = () => (cachedSpr ??= makeAntSprites('#4a3558', 'rgba(255,255,255,0.7)'));
let cachedSpr: AntSprites | null = null;

function antPreview(id: CaptainId) {
  const cv = h('canvas', { width: 180, height: 180 });
  const g = cv.getContext('2d')!;
  g.scale(2, 2);
  drawAnt(g, previewSprites(), 45, 50, 0, 70 * (id === 'chubby' ? 1.1 : 1), 0);
  drawAccessory(g, id, 45, 50, 70 * (id === 'chubby' ? 1.1 : 1), 0);
  return h('div', { class: 'pv' }, cv);
}

function collectionScreen() {
  const grid = h('div', { class: 'grid' });
  for (const c of CAPTAINS) {
    const owned = save.owned.includes(c.id);
    const active = save.captain === c.id;
    const action = active
      ? h('div', { class: 'btn small white', textContent: `✔ ${t('equipped')}` })
      : owned
        ? btn(t('equip'), 'small sky', () => {
            save.captain = c.id;
            persist();
            sound.buy();
            collectionScreen();
          })
        : btn(`🍯 ${fmt(c.cost)}`, 'small', () => {
            if (save.honey < c.cost) {
              sound.nope();
              toast(t('notEnough'));
              return;
            }
            save.honey -= c.cost;
            save.owned.push(c.id);
            save.captain = c.id;
            persist();
            sound.win();
            collectionScreen();
          });
    grid.append(
      h('div', { class: `card${active ? ' active' : ''}${owned ? '' : ' locked'}` },
        antPreview(c.id),
        h('div', { class: 'name', textContent: tr(c.name) }),
        h('div', { class: 'desc', textContent: tr(c.perk) }),
        action,
      ),
    );
  }
  show(
    honeyPill(),
    h('div', { class: 'screen' },
      h('div', { class: 'panel' }, h('h2', { textContent: `🐜 ${t('captain')}` }), grid, h('div', { class: 'center' }, btn(`↩ ${t('back')}`, 'white', menuScreen))),
    ),
  );
}

function settingsScreen() {
  const toggle = (on: boolean, f: () => void) => btn(on ? `🔊 ${t('on')}` : `🔇 ${t('off')}`, `small ${on ? 'sky' : 'white'}`, f);
  show(
    h('div', { class: 'screen' },
      h('div', { class: 'panel' },
        h('h2', { textContent: `⚙️ ${t('settings')}` }),
        h('div', { class: 'setting' }, t('language'),
          h('div', { class: 'row' },
            btn('🇻🇳 VI', `small ${getLang() === 'vi' ? 'sky' : 'white'}`, () => setLanguage('vi')),
            btn('🇬🇧 EN', `small ${getLang() === 'en' ? 'sky' : 'white'}`, () => setLanguage('en')),
          ),
        ),
        h('div', { class: 'setting' }, t('sound'), toggle(save.sfx, () => {
          save.sfx = !save.sfx;
          sound.sfxOn = save.sfx;
          sound.applySettings();
          persist();
          settingsScreen();
        })),
        h('div', { class: 'setting' }, t('music'), toggle(save.music, () => {
          save.music = !save.music;
          sound.musicOn = save.music;
          sound.applySettings();
          persist();
          settingsScreen();
        })),
        h('div', { class: 'setting' }, '', btn(`🗑 ${t('reset')}`, 'small pink', () => {
          if (confirm(t('resetConfirm'))) {
            save = resetSave();
            menuScreen();
          }
        })),
        h('div', { class: 'center', style: 'margin-top:12px' }, btn(`↩ ${t('back')}`, 'white', menuScreen)),
      ),
    ),
  );
}

function setLanguage(l: 'vi' | 'en') {
  save.lang = l;
  setLang(l);
  persist();
  settingsScreen();
}

// ------------------------------------------------------------------ play
function startRun(daily: boolean) {
  sound.unlock();
  runIsDaily = daily;
  const key = todayKey();
  const lv = daily
    ? generateLevel(8, hashString('daily-' + key), hashString(key) % THEMES.length)
    : generateLevel(save.level, hashString('level-' + save.level));
  lv.daily = daily;
  // Mercy rule: every failed attempt shaves 8% off the boss (down to 60%).
  if (!daily) lv.bossHP = Math.max(8, Math.round(lv.bossHP * Math.max(0.6, 1 - save.fails * 0.08)));
  sound.party = save.captain === 'dj';
  run = new Run(lv, stats(), sound, onRunEnd);
  sound.setMusic('menu');
  show(btn('⏸', 'white icon-btn pause-btn', pauseScreen));
}

function pauseScreen() {
  if (!run || run.ended) return;
  run.paused = true;
  show(
    h('div', { class: 'screen dim' },
      h('div', { class: 'panel center' },
        h('h2', { textContent: `⏸ ${t('paused')}` }),
        h('div', { class: 'list' },
          btn(`▶ ${t('resume')}`, 'big', () => {
            if (run) run.paused = false;
            show(btn('⏸', 'white icon-btn pause-btn', pauseScreen));
          }),
          btn(`↻ ${t('retry')}`, 'sky', () => startRun(runIsDaily)),
          btn(`🏠 ${t('home')}`, 'white', menuScreen),
        ),
      ),
    ),
  );
}

function onRunEnd(r: RunResult) {
  save.honey += r.total;
  let newBest = false;
  if (runIsDaily) {
    const k = todayKey();
    if (r.total > (save.daily[k] ?? 0)) {
      save.daily[k] = r.total;
      newBest = true;
    }
  } else if (r.win) {
    save.level++;
    save.fails = 0;
  } else {
    save.fails++;
  }
  persist();
  resultScreen(r, newBest);
}

function resultScreen(r: RunResult, newBest: boolean) {
  const line = (label: string, v: number) => h('div', {}, h('span', { textContent: label }), h('span', { textContent: `+${fmt(v)}` }));
  const total = h('span', { textContent: '0' });
  const lines = h('div', { class: 'result-lines' },
    h('div', {}, h('span', { textContent: `🐜 ${t('antsLeft')}` }), h('span', { textContent: fmt(r.antsLeft) })),
    line(`🍞 ${t('crumbs')}`, r.crumbHoney + r.fightHoney),
    line(`🍉 ${t('bigFood')}`, r.foodHoney),
    line(`⭐ ${t('bonus')}`, r.bonus),
    h('div', { class: 'tot' }, h('span', { textContent: `🍯 ${t('total')}` }), total),
  );
  // count-up animation
  const t0 = performance.now();
  const tick = () => {
    const k = Math.min(1, (performance.now() - t0) / 900);
    total.textContent = fmt(Math.round(r.total * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(tick);
  };
  tick();
  const primary = r.win && !runIsDaily
    ? btn(`▶ ${t('level')} ${save.level}`, 'big', () => startRun(false))
    : btn(`↻ ${t('retry')}`, 'big', () => startRun(runIsDaily));
  show(
    honeyPill(),
    h('div', { class: 'screen dim' },
      h('div', { class: 'panel center' },
        h('h2', { textContent: r.win ? `🎉 ${t('win')}` : `😵 ${t('lose')}` }),
        newBest ? h('div', { class: 'tagline', textContent: `🏆 ${t('newBest')}` }) : '',
        lines,
        h('div', { class: 'list' },
          primary,
          h('div', { class: 'row' }, btn(`🏠 ${t('nest')}`, 'pink small', nestScreen), btn(`↩ ${t('home')}`, 'white small', menuScreen)),
        ),
      ),
    ),
  );
}

// ------------------------------------------------------------------ input
canvas.addEventListener('pointerdown', (e) => {
  sound.unlock();
  canvas.setPointerCapture(e.pointerId);
  run?.pointerDown(e.clientX);
});
canvas.addEventListener('pointermove', (e) => run?.pointerMove(e.clientX));
canvas.addEventListener('pointerup', () => run?.pointerUp());
canvas.addEventListener('pointercancel', () => run?.pointerUp());
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (run && !run.paused && !run.ended) pauseScreen();
    return;
  }
  if (run && !run.paused) {
    sound.unlock();
    run.key(e.code, true);
  }
});
window.addEventListener('keyup', (e) => run?.key(e.code, false));
document.addEventListener('visibilitychange', () => {
  if (document.hidden && run && !run.paused && !run.ended && run.phase !== 'ready') pauseScreen();
});

// ------------------------------------------------------------------ menu backdrop
const menuSpr = makeAntSprites();
let menuT = 0;
function drawMenu(dt: number) {
  menuT += dt;
  setBoil(menuT);
  const scale = Math.min(W / 430, H / 720) * 1.1;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, (dpr * W) / 2, (dpr * H) / 2);
  const cam = menuT * 30;
  const theme = Math.floor(menuT / 12) % THEMES.length;
  const halfH = H / 2 / scale + 30;
  drawGround(ctx, THEMES[theme], theme, cam, -halfH, halfH, W / 2 / scale + 10);
  // two marching lines of ants carrying crumbs along wavy trails
  for (let lane = 0; lane < 2; lane++) {
    for (let i = 0; i < 26; i++) {
      const p = ((menuT * 0.06 + i / 26 + lane * 0.5) % 1) * 2 - 1;
      const y = p * halfH * (lane ? 1 : -1);
      const dir = lane ? 1 : -1;
      const x = (lane ? 120 : -120) + Math.sin(y * 0.02 + lane) * 40;
      const ang = lane ? Math.PI : 0;
      drawAnt(ctx, menuSpr, x, y, ang + Math.cos(y * 0.02 + lane) * 0.6 * dir, 16, Math.floor(menuT * 12 + i));
      if (i % 3 === 0) drawCrumb(ctx, i % 6 === 0 ? 'sugar' : 'bread', x, y + (lane ? 10 : -10), i, menuT);
    }
  }
}

// ------------------------------------------------------------------ loop
let last = performance.now();
function frame(now: number) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (run) {
    const steps = import.meta.env.DEV ? (window as any).__speed || 1 : 1;
    for (let i = 0; i < steps; i++) run.update(dt);
    run.render(ctx, W, H, dpr);
  } else {
    drawMenu(dt);
  }
  requestAnimationFrame(frame);
}

// Exposed in dev builds only, for the balance-testing bot.
if (import.meta.env.DEV) (window as any).__run = () => run;

menuScreen();
requestAnimationFrame(frame);
