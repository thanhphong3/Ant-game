// Three daily quests, the same for everyone on a given day, that pay out honey.
import type { Txt } from './data';
import type { RunResult } from './game';
import { hashString, mulberry32 } from './rng';

export type QuestId =
  | 'crumbs' | 'wins' | 'stars3' | 'mystery' | 'squads' | 'foods'
  | 'fever' | 'counter' | 'jars' | 'swarm' | 'power' | 'boost' | 'bugs' | 'smash';

interface QuestDef {
  id: QuestId;
  icon: string;
  text: Txt; // {0} = goal
  goals: number[];
  minLevel: number; // don't ask for things the player hasn't met yet
  progress: (r: RunResult) => number;
  best?: boolean; // goal is a best single run, not a running total
}

const QUESTS: QuestDef[] = [
  { id: 'crumbs', icon: '🍞', text: { vi: 'Ăn {0} vụn bánh', en: 'Munch {0} crumbs' }, goals: [80, 150, 250], minLevel: 1, progress: (r) => r.tally.crumbs },
  { id: 'wins', icon: '🏆', text: { vi: 'Thắng {0} màn', en: 'Win {0} levels' }, goals: [2, 3, 4], minLevel: 1, progress: (r) => (r.win ? 1 : 0) },
  { id: 'stars3', icon: '⭐', text: { vi: 'Thắng 3 sao {0} lần', en: 'Win with 3 stars {0} times' }, goals: [1, 2, 3], minLevel: 1, progress: (r) => (r.stars === 3 ? 1 : 0) },
  { id: 'mystery', icon: '❓', text: { vi: 'Đi qua {0} cổng bí ẩn', en: 'Walk through {0} mystery gates' }, goals: [2, 3, 5], minLevel: 2, progress: (r) => r.tally.mystery },
  { id: 'squads', icon: '🪲', text: { vi: 'Hạ {0} đội bọ cánh cứng', en: 'Beat {0} beetle squads' }, goals: [3, 5, 8], minLevel: 2, progress: (r) => r.tally.squads },
  { id: 'foods', icon: '🍉', text: { vi: 'Khiêng {0} mồi to về tổ', en: 'Carry home {0} big foods' }, goals: [1, 2, 3], minLevel: 8, progress: (r) => r.tally.foods },
  { id: 'fever', icon: '🔥', text: { vi: 'Vào chế độ cuồng nhiệt {0} lần', en: 'Go into fever {0} times' }, goals: [2, 4, 6], minLevel: 1, progress: (r) => r.tally.fever },
  { id: 'counter', icon: '💥', text: { vi: 'Phản đòn trùm {0} lần', en: 'Counter the boss {0} times' }, goals: [2, 4, 6], minLevel: 1, progress: (r) => r.tally.counters },
  { id: 'jars', icon: '🔓', text: { vi: 'Giải cứu {0} hũ kiến', en: 'Free {0} ant jars' }, goals: [1, 2, 3], minLevel: 2, progress: (r) => r.tally.jars },
  { id: 'swarm', icon: '🐜', text: { vi: 'Có {0} kiến cùng lúc', en: 'Have {0} ants at once' }, goals: [50, 80, 120], minLevel: 1, progress: (r) => r.tally.maxAnts, best: true },
  { id: 'power', icon: '✨', text: { vi: 'Nhặt {0} power-up', en: 'Grab {0} power-ups' }, goals: [2, 4, 6], minLevel: 1, progress: (r) => r.tally.powerups },
  { id: 'boost', icon: '⚡', text: { vi: 'Tăng tốc {0} lần', en: 'Dash {0} times' }, goals: [1, 2, 4], minLevel: 3, progress: (r) => r.tally.boosts },
  { id: 'bugs', icon: '🐞', text: { vi: 'Bắt {0} bọ rùa vàng', en: 'Catch {0} golden ladybugs' }, goals: [1, 2, 3], minLevel: 1, progress: (r) => r.tally.bugs },
  { id: 'smash', icon: '🍄', text: { vi: 'Đạp bẹp {0} chướng ngại', en: 'Squash {0} obstacles' }, goals: [2, 4, 6], minLevel: 4, progress: (r) => r.tally.smashed },
];

export interface QuestState { id: QuestId; goal: number; prog: number; reward: number; claimed: boolean }
export interface QuestBook { day: string; list: QuestState[]; bonus: number; bonusClaimed: boolean }

export const questDef = (id: QuestId) => QUESTS.find((q) => q.id === id);

const round5 = (n: number) => Math.round(n / 5) * 5;

export function makeQuests(day: string, level: number): QuestBook {
  const rnd = mulberry32(hashString('quests-' + day));
  const pool = QUESTS.filter((q) => level >= q.minLevel);
  const list: QuestState[] = [];
  while (list.length < 3 && pool.length) {
    const def = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    const tier = Math.min(def.goals.length - 1, Math.floor(rnd() * 2) + (level >= 10 ? 1 : 0));
    list.push({ id: def.id, goal: def.goals[tier], prog: 0, reward: round5((40 + level * 6) * (1 + tier * 0.5)), claimed: false });
  }
  return { day, list, bonus: round5(60 + level * 8), bonusClaimed: false };
}

/** Adds a finished run to the quest book and returns how many quests it just completed. */
export function trackQuests(book: QuestBook, r: RunResult): number {
  let done = 0;
  for (const q of book.list) {
    const def = questDef(q.id);
    if (!def || q.prog >= q.goal) continue;
    const p = def.progress(r);
    q.prog = Math.min(q.goal, def.best ? Math.max(q.prog, p) : q.prog + p);
    if (q.prog >= q.goal) done++;
  }
  return done;
}

export const bonusReady = (book: QuestBook) => !book.bonusClaimed && book.list.every((q) => q.claimed);

/** Rewards waiting to be collected (for the menu badge). */
export const claimable = (book: QuestBook) =>
  book.list.filter((q) => q.prog >= q.goal && !q.claimed).length + (bonusReady(book) ? 1 : 0);
