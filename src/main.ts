import './style.css';
import { drawAccessory, drawAnt, drawCrumb, drawGround, makeAntSprites, setBoil, type AntSprites } from './art';
import { Sound } from './audio';
import { CAPTAINS, THEMES, UPGRADES, upgradeCost, type CaptainId } from './data';
import { Run, type RunResult, type RunStats } from './game';
import { getLang, setLang, t, tr } from './i18n';
import { generateLevel, isHardLevel } from './level';
import { bonusReady, claimable, makeQuests, questDef, trackQuests } from './quests';
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
let giftOffered = false;

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

function toast(msg: string, ms = 1400) {
  const el = h('div', { class: 'toast', textContent: msg });
  el.style.bottom = `${40 + ui.querySelectorAll('.toast').length * 44}px`; // stack, don't overlap
  ui.append(el);
  setTimeout(() => el.remove(), ms);
}

const honeyPill = () => h('div', { class: 'honey-pill', textContent: `🍯 ${save.honey}` });
const persist = () => writeSave(save);
const fmt = (n: number) => n.toLocaleString(getLang() === 'vi' ? 'vi-VN' : 'en-US');

/** Today's quest book, rolled over at midnight. */
function quests() {
  const day = todayKey();
  if (!save.quests || save.quests.day !== day || save.quests.list.some((q) => !questDef(q.id))) {
    save.quests = makeQuests(day, save.level);
    persist();
  }
  return save.quests;
}

// 7-day login streak; day 7 is the big one.
const GIFTS = [30, 50, 80, 120, 160, 220, 400];
const giftAmount = (day: number) => Math.round((GIFTS[day - 1] * (1 + Math.min(save.level, 60) * 0.05)) / 5) * 5;
/** The streak day today's gift would be (1..7), or 0 when it was already opened today. */
function giftDay() {
  const g = save.gift;
  if (g.day === todayKey()) return 0;
  return g.day === todayKey(-1) ? (g.streak % 7) + 1 : 1;
}

/** Ease a number shown in `el` from `from` to `to`. */
function countUp(el: HTMLElement, from: number, to: number, ms: number) {
  const t0 = performance.now();
  const tick = () => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    el.textContent = fmt(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(tick);
  };
  tick();
}

/** Every 5th level has a tougher boss: flag it so players know to power up first. */
const levelName = (n: number) => `${t('level')} ${n}${isHardLevel(n) ? ' 💀' : ''}`;

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
  const nq = claimable(quests());
  const gd = giftDay();
  show(
    honeyPill(),
    h('div', { class: 'screen' },
      title,
      h('div', { class: 'subtitle', textContent: other }),
      h('div', { class: 'tagline', textContent: t('tagline') }),
      h('div', { style: 'height:8px' }),
      btn(`▶ ${t('play')} · ${levelName(save.level)}`, 'big', () => startRun(false)),
      btn(`📅 ${t('daily')}${best ? `<span class="best">&nbsp;(${t('dailyBest')}: ${fmt(best)})</span>` : ''}`, 'sky', () => startRun(true)),
      h('div', { class: 'row' },
        btn(`🏠 ${t('nest')}`, 'pink', nestScreen),
        btn(`🐜 ${t('colony')}`, 'grape', collectionScreen),
      ),
      h('div', { class: 'row' },
        btn(`📜 ${t('quests')}${nq ? `<span class="dot">${nq}</span>` : ''}`, 'quest-btn', questScreen),
        btn(`🎁${gd ? '<span class="dot">!</span>' : ''}`, `white icon-btn quest-btn${gd ? ' gift-ready' : ''}`, giftScreen),
        btn('⚙️', 'white icon-btn', settingsScreen),
      ),
    ),
    h('div', { class: 'version', textContent: 'v1.4' }),
  );
  // Pop the daily gift open by itself, once per visit.
  if (gd && !giftOffered) {
    giftOffered = true;
    giftScreen();
  }
}

function giftScreen() {
  giftOffered = true;
  const today = giftDay();
  const cur = today || save.gift.streak;
  const grid = h('div', { class: 'gifts' });
  for (let d = 1; d <= 7; d++) {
    const ready = d === cur && today > 0;
    const done = d < cur || (d === cur && !today);
    grid.append(
      h('div', { class: `gift${ready ? ' ready' : done ? ' done' : ''}${d === 7 ? ' big' : ''}` },
        h('div', { class: 'gday', textContent: t('day', d) }),
        h('div', { class: 'gbox', textContent: done ? '✔' : d === 7 ? '👑' : '🎁' }),
        h('div', { class: 'gamt', textContent: `🍯${fmt(giftAmount(d))}` }),
      ),
    );
  }
  const action = today
    ? btn(`🎁 ${t('open')}`, 'big', () => {
        const amount = giftAmount(today);
        save.honey += amount;
        save.gift = { day: todayKey(), streak: today };
        persist();
        sound.gift();
        toast(`🎉 +${fmt(amount)} 🍯`, 1800);
        giftScreen();
        ui.querySelector('.gift.done:nth-child(' + today + ')')?.classList.add('just');
      })
    : h('div', { class: 'tagline', textContent: `🌙 ${t('giftTomorrow')}` });
  show(
    honeyPill(),
    h('div', { class: 'screen' },
      h('div', { class: 'panel center' },
        h('h2', { textContent: `🎁 ${t('gift')}` }),
        h('div', { class: 'tagline', textContent: t('giftSub') }),
        grid,
        h('div', { class: 'list' }, action, btn(`↩ ${t('back')}`, 'white small', menuScreen)),
      ),
    ),
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

function questScreen() {
  const book = quests();
  const claim = (amount: number, mark: () => void) => {
    mark();
    save.honey += amount;
    persist();
    sound.win();
    questScreen();
  };
  const list = h('div', { class: 'list' });
  for (const q of book.list) {
    const def = questDef(q.id)!;
    const done = q.prog >= q.goal;
    const fill = h('div', { class: 'qfill' });
    fill.style.width = `${(q.prog / q.goal) * 100}%`;
    const action = q.claimed
      ? h('div', { class: 'btn small white', textContent: '✔' })
      : done
        ? btn(`${t('claim')} 🍯${fmt(q.reward)}`, 'small', () => claim(q.reward, () => (q.claimed = true)))
        : h('div', { class: 'qreward', textContent: `🍯 ${fmt(q.reward)}` });
    list.append(
      h('div', { class: `item${q.claimed ? ' claimed' : done ? ' ready' : ''}` },
        h('div', { class: 'ico', textContent: def.icon }),
        h('div', { class: 'info' },
          h('div', { class: 'name', textContent: tr(def.text).replace('{0}', fmt(q.goal)) }),
          h('div', { class: 'qbar' }, fill),
          h('div', { class: 'desc', textContent: `${fmt(q.prog)} / ${fmt(q.goal)}` }),
        ),
        action,
      ),
    );
  }
  const bonus = book.bonusClaimed
    ? h('div', { class: 'btn small white', textContent: '✔' })
    : bonusReady(book)
      ? btn(`${t('claim')} 🍯${fmt(book.bonus)}`, 'small', () => claim(book.bonus, () => (book.bonusClaimed = true)))
      : h('div', { class: 'qreward', textContent: `🍯 ${fmt(book.bonus)}` });
  list.append(
    h('div', { class: `item bonus${book.bonusClaimed ? ' claimed' : ''}` },
      h('div', { class: 'ico', textContent: '🎁' }),
      h('div', { class: 'info' }, h('div', { class: 'name', textContent: t('allQuests') })),
      bonus,
    ),
  );
  show(
    honeyPill(),
    h('div', { class: 'screen' },
      h('div', { class: 'panel' },
        h('h2', { textContent: `📜 ${t('quests')}` }),
        h('div', { class: 'tagline', textContent: t('questsSub') }),
        list,
        h('div', { class: 'center' }, btn(`↩ ${t('back')}`, 'white', menuScreen)),
      ),
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

const reviveCost = () => 25 + save.level * 8;

function onRunEnd(r: RunResult) {
  // One second chance per run (not in the daily challenge): free once a day, then it costs honey.
  if (!r.win && run && !runIsDaily && run.revives === 0) {
    const free = save.freeRevive !== todayKey();
    const cost = reviveCost();
    if (free || save.honey >= cost) {
      reviveScreen(run, r, free, cost);
      return;
    }
  }
  finishRun(r);
}

function reviveScreen(cur: Run, r: RunResult, free: boolean, cost: number) {
  let left = 5;
  let done = false;
  const num = h('div', { class: 'revive-count', textContent: String(left) });
  const close = () => {
    done = true;
    clearInterval(timer);
  };
  const giveUp = () => {
    if (done) return;
    close();
    finishRun(r);
  };
  const timer = setInterval(() => {
    if (done) return;
    left--;
    num.textContent = String(left);
    num.classList.remove('tick');
    void num.offsetWidth; // restart the pulse animation
    num.classList.add('tick');
    sound.tick();
    if (left <= 0) giveUp();
  }, 1000);
  const accept = btn(free ? `💖 ${t('reviveFree')}` : `💖 ${t('reviveBtn')} · 🍯${fmt(cost)}`, 'big revive-btn', () => {
    if (done || run !== cur) return;
    close();
    if (free) save.freeRevive = todayKey();
    else save.honey -= cost;
    persist();
    cur.revive();
    show(btn('⏸', 'white icon-btn pause-btn', pauseScreen));
  });
  show(
    honeyPill(),
    h('div', { class: 'screen dim' },
      h('div', { class: 'panel center' },
        h('div', { class: 'revive-ant', textContent: '🐜💫' }),
        h('h2', { textContent: t('revive') }),
        h('div', { class: 'tagline', textContent: t('reviveSub', cur.reviveAnts) }),
        num,
        h('div', { class: 'list' }, accept, btn(t('skip'), 'white small', giveUp)),
      ),
    ),
  );
}

function finishRun(r: RunResult) {
  save.honey += r.total;
  const questsDone = trackQuests(quests(), r);
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
  resultScreen(r, newBest, questsDone);
}

function starRow(n: number) {
  const row = h('div', { class: 'stars' });
  for (let i = 0; i < 3; i++) {
    const st = h('span', { class: `star${i < n ? ' on' : ''}`, textContent: '★' });
    st.style.animationDelay = `${0.25 + i * 0.22}s`;
    if (i < n) setTimeout(() => sound.buy(), 250 + i * 220);
    row.append(st);
  }
  return row;
}

/**
 * Victory bonus: a needle swings across ×1.5 / ×2 / ×3 slots and the player
 * taps to stop it. The needle is fastest over the narrow ×3 in the middle.
 */
function luckyBar(onStop: (mult: number) => void) {
  const SEGS = [1.5, 2, 3, 2, 1.5];
  const EDGES = [0, 0.2, 0.44, 0.56, 0.8, 1];
  const segAt = (p: number) => {
    const i = EDGES.findIndex((e) => p < e);
    return i < 0 ? SEGS.length - 1 : Math.max(0, i - 1);
  };
  const bar = h('div', { class: 'lucky-bar' });
  SEGS.forEach((m, i) => {
    const seg = h('div', { class: `seg${m === 3 ? ' top' : m === 2 ? ' mid' : ''}`, textContent: `×${m}` });
    seg.style.flex = String(EDGES[i + 1] - EDGES[i]);
    bar.append(seg);
  });
  const needle = h('div', { class: 'needle' });
  bar.append(needle);
  let p = 0;
  let seg = -1;
  let stopped = false;
  const t0 = performance.now();
  const stop = btn(`🍀 ${t('stop')}`, 'lucky-btn', () => {
    if (stopped) return;
    stopped = true;
    stop.disabled = true;
    const i = segAt(p);
    bar.children[i].classList.add('hit');
    onStop(SEGS[i]);
  });
  const spin = () => {
    if (stopped || !bar.isConnected) return;
    p = 0.5 - 0.5 * Math.cos(((performance.now() - t0) / 1000) * 2.8);
    needle.style.left = `${p * 100}%`;
    const i = segAt(p);
    if (i !== seg) {
      seg = i;
      stop.innerHTML = `🍀 ${t('stop')} ×${SEGS[i]}`;
      sound.tick();
    }
    requestAnimationFrame(spin);
  };
  requestAnimationFrame(spin);
  return h('div', { class: 'lucky' }, h('div', { class: 'lucky-title', textContent: t('lucky') }), bar, stop);
}

function resultScreen(r: RunResult, newBest: boolean, questsDone: number) {
  const line = (label: string, v: number) => h('div', {}, h('span', { textContent: label }), h('span', { textContent: `+${fmt(v)}` }));
  const total = h('span', { textContent: '0' });
  const lines = h('div', { class: 'result-lines' },
    h('div', {}, h('span', { textContent: `🐜 ${t('antsLeft')}` }), h('span', { textContent: fmt(r.antsLeft) })),
    line(`🍞 ${t('crumbs')}`, r.crumbHoney + r.fightHoney),
    line(`🍉 ${t('bigFood')}`, r.foodHoney),
    r.bugHoney ? line(`🐞 ${t('goldBug')}`, r.bugHoney) : '',
    line(`🎖 ${t('bonus')}`, r.bonus),
    r.win ? line(`⭐ ${t('starBonus')}`, r.starBonus) : '',
    h('div', { class: 'tot' }, h('span', { textContent: `🍯 ${t('total')}` }), total),
  );
  countUp(total, 0, r.total, 900);
  const pill = honeyPill();
  const lucky = r.win
    ? luckyBar((mult) => {
        const extra = Math.round(r.total * (mult - 1));
        save.honey += extra;
        persist();
        sound.win();
        countUp(total, r.total, r.total + extra, 700);
        pill.textContent = `🍯 ${save.honey}`;
        toast(`🍀 ×${mult}! +${fmt(extra)} 🍯`);
      })
    : '';
  const primary = r.win && !runIsDaily
    ? btn(`▶ ${levelName(save.level)}`, 'big', () => startRun(false))
    : btn(`↻ ${t('retry')}`, 'big', () => startRun(runIsDaily));
  show(
    pill,
    h('div', { class: 'screen dim' },
      h('div', { class: 'panel center' },
        h('h2', { textContent: r.win ? `🎉 ${t('win')}` : `😵 ${t('lose')}` }),
        r.win ? starRow(r.stars) : '',
        newBest ? h('div', { class: 'tagline', textContent: `🏆 ${t('newBest')}` }) : '',
        lines,
        lucky,
        h('div', { class: 'list' },
          primary,
          h('div', { class: 'row' }, btn(`🏠 ${t('nest')}`, 'pink small', nestScreen), btn(`↩ ${t('home')}`, 'white small', menuScreen)),
        ),
      ),
    ),
  );
  if (questsDone) setTimeout(() => toast(`📜 ${t('questDone')}`, 2200), 1100);
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
// Phones only let audio start from the END of a tap (touchend / click), not from
// pointerdown, so listen for those everywhere, on every tap, until it is running.
for (const ev of ['touchend', 'pointerup', 'click', 'keydown'] as const) {
  window.addEventListener(ev, () => sound.unlock(), { capture: true, passive: true });
}
document.addEventListener('visibilitychange', () => {
  sound.sleep(document.hidden);
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
