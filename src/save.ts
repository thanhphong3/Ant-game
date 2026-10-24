import type { CaptainId, UpgradeId } from './data';
import type { Lang } from './i18n';
import type { QuestBook } from './quests';

export interface SaveData {
  honey: number;
  level: number;
  upgrades: Record<UpgradeId, number>;
  owned: CaptainId[];
  captain: CaptainId;
  lang: Lang;
  sfx: boolean;
  music: boolean;
  daily: Record<string, number>;
  fails: number; // failed attempts on the current level (makes the boss a bit weaker)
  quests: QuestBook | null;
  freeRevive: string; // day the free revive was last used
  gift: { day: string; streak: number }; // last daily gift claimed, and how many days in a row
}

const KEY = 'ant-rumble-save-v1';

const fresh = (): SaveData => ({
  honey: 0,
  level: 1,
  upgrades: { colony: 0, power: 0, magnet: 0, armor: 0, honey: 0 },
  owned: ['basic'],
  captain: 'basic',
  lang: navigator.language?.toLowerCase().startsWith('vi') ? 'vi' : 'en',
  sfx: true,
  music: true,
  daily: {},
  fails: 0,
  quests: null,
  freeRevive: '',
  gift: { day: '', streak: 0 },
});

export function loadSave(): SaveData {
  const base = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const data = JSON.parse(raw);
    return { ...base, ...data, upgrades: { ...base.upgrades, ...data.upgrades } };
  } catch {
    return base;
  }
}

export function writeSave(s: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: progress lives only for this tab */
  }
}

export function resetSave(): SaveData {
  const lang = loadSave().lang;
  const s = { ...fresh(), lang };
  writeSave(s);
  return s;
}

/** Local calendar day, `offset` days from today. */
export const todayKey = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
