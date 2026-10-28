import type { CaptainId, UpgradeId } from './data';
import type { Lang } from './i18n';
import { freshLife, type LifeStats, type SkinId } from './meta';
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
  shake: boolean;
  haptics: boolean;
  daily: Record<string, number>;
  fails: number; // failed attempts on the current level (makes the boss a bit weaker)
  quests: QuestBook | null;
  freeRevive: string; // day the free revive was last used
  gift: { day: string; streak: number }; // last daily gift claimed, and how many days in a row
  /** balance version the save was made under (2 = upgrade prices from the v1.4 rebalance) */
  ver: number;
  tutorial: boolean; // finished the guided first levels
  stars: Record<number, number>; // best stars per level
  chests: number; // star chests opened
  life: LifeStats;
  levels: Record<number, { tries: number; wins: number; quits: number }>;
  ach: string[]; // achievements claimed
  skin: SkinId;
  skins: SkinId[];
  tips: string[]; // first-look tips already shown (squads, slot gates…)
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
  shake: true,
  haptics: true,
  daily: {},
  fails: 0,
  quests: null,
  freeRevive: '',
  gift: { day: '', streak: 0 },
  ver: 2,
  tutorial: false,
  stars: {},
  chests: 0,
  life: freshLife(),
  levels: {},
  ach: [],
  skin: 'classic',
  skins: ['classic'],
  tips: [],
});

export function loadSave(): SaveData {
  const base = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const data = JSON.parse(raw);
    return {
      ...base,
      ...data,
      upgrades: { ...base.upgrades, ...data.upgrades },
      life: { ...base.life, ...data.life },
      // saves from before versioning were made under the old, cheaper upgrade prices;
      // anyone past level 2 already knows how to play
      ver: data.ver ?? 1,
      tutorial: data.tutorial ?? (data.level ?? 1) > 2,
      // saves from before first-look tips: past level 5 everything has been met already
      tips: data.tips ?? ((data.level ?? 1) > 5 ? ['squad', 'slot', 'mystery', 'food', 'power', 'giant', 'boost', 'pea', 'boss'] : []),
    };
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
