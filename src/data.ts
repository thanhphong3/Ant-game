import type { Lang } from './i18n';

type Txt = { vi: string; en: string };

export type UpgradeId = 'colony' | 'power' | 'magnet' | 'armor' | 'honey';

export interface UpgradeDef {
  id: UpgradeId;
  icon: string;
  name: Txt;
  desc: Txt;
  max: number;
  baseCost: number;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'colony', icon: '🐜', name: { vi: 'Đàn khởi đầu', en: 'Starting swarm' }, desc: { vi: '+2 kiến khi bắt đầu', en: '+2 ants at start' }, max: 20, baseCost: 25 },
  { id: 'power', icon: '💪', name: { vi: 'Sức mạnh', en: 'Strength' }, desc: { vi: '+10% sức đánh', en: '+10% fighting power' }, max: 20, baseCost: 40 },
  { id: 'magnet', icon: '🧲', name: { vi: 'Nam châm', en: 'Magnet' }, desc: { vi: 'Hút vụn bánh xa hơn', en: 'Grab crumbs from further' }, max: 10, baseCost: 30 },
  { id: 'armor', icon: '🍃', name: { vi: 'Giáp lá', en: 'Leaf armor' }, desc: { vi: '+4% sống sót khi trúng bẫy', en: '+4% survive traps' }, max: 15, baseCost: 35 },
  { id: 'honey', icon: '🍯', name: { vi: 'Hũ mật', en: 'Honey jar' }, desc: { vi: '+10% mật nhận được', en: '+10% honey earned' }, max: 15, baseCost: 50 },
];

export const upgradeCost = (u: UpgradeDef, lvl: number) => Math.round(u.baseCost * Math.pow(1.38, lvl));

export type CaptainId = 'basic' | 'hat' | 'ninja' | 'chubby' | 'dj' | 'astro' | 'knight' | 'king';

export interface CaptainDef {
  id: CaptainId;
  name: Txt;
  perk: Txt;
  cost: number;
}

export const CAPTAINS: CaptainDef[] = [
  { id: 'basic', name: { vi: 'Kiến Tí', en: "Lil' Ant" }, perk: { vi: 'Nhỏ mà có võ', en: 'Small but mighty' }, cost: 0 },
  { id: 'hat', name: { vi: 'Kiến Nón Lá', en: 'Conical Hat Ant' }, perk: { vi: '+4 kiến khởi đầu', en: '+4 starting ants' }, cost: 150 },
  { id: 'ninja', name: { vi: 'Kiến Ninja', en: 'Ninja Ant' }, perk: { vi: '20% né bẫy', en: '20% dodge traps' }, cost: 320 },
  { id: 'chubby', name: { vi: 'Kiến Béo', en: 'Chubby Ant' }, perk: { vi: 'Cổng cộng thêm +25%', en: 'Plus-gates give +25%' }, cost: 500 },
  { id: 'dj', name: { vi: 'Kiến DJ', en: 'DJ Ant' }, perk: { vi: 'Vụn bánh x2 mật', en: 'Crumbs give x2 honey' }, cost: 700 },
  { id: 'astro', name: { vi: 'Kiến Phi Hành Gia', en: 'Astro Ant' }, perk: { vi: 'Hút vụn xa +60%', en: '+60% magnet range' }, cost: 950 },
  { id: 'knight', name: { vi: 'Kiến Hiệp Sĩ', en: 'Knight Ant' }, perk: { vi: '+30% sức đánh', en: '+30% power' }, cost: 1300 },
  { id: 'king', name: { vi: 'Kiến Vua', en: 'King Ant' }, perk: { vi: '+30% mật', en: '+30% honey' }, cost: 1800 },
];

export interface ThemeDef {
  name: Txt;
  bg: string;
  bg2: string;
  side: string;
  edge: string;
}

export const THEMES: ThemeDef[] = [
  { name: { vi: 'Khăn picnic', en: 'Picnic blanket' }, bg: '#fff3e6', bg2: '#ffc9cf', side: '#9fd47a', edge: '#e2788a' },
  { name: { vi: 'Bàn bếp', en: 'Kitchen counter' }, bg: '#e8fbf5', bg2: '#bfeee0', side: '#c9b6e4', edge: '#6fbfa8' },
  { name: { vi: 'Vườn sau nhà', en: 'Backyard garden' }, bg: '#d9b98c', bg2: '#c9a372', side: '#7cc46a', edge: '#8a6a42' },
  { name: { vi: 'Sàn phòng ngủ', en: 'Bedroom floor' }, bg: '#f0c98f', bg2: '#e3b577', side: '#8fb6e8', edge: '#b98a4e' },
  { name: { vi: 'Xứ kẹo ngọt', en: 'Candy land' }, bg: '#fde7f6', bg2: '#d9f1ff', side: '#ffd36e', edge: '#e58fc4' },
];

export type BossKind = 'spider' | 'frog' | 'lizard' | 'beetleKing';
export const BOSSES: { kind: BossKind; name: Txt }[] = [
  { kind: 'spider', name: { vi: 'Nhện Lông Lá', en: 'Fuzzy Spider' } },
  { kind: 'frog', name: { vi: 'Ếch Háu Ăn', en: 'Hungry Frog' } },
  { kind: 'lizard', name: { vi: 'Thằn Lằn Lém Lỉnh', en: 'Sneaky Gecko' } },
  { kind: 'beetleKing', name: { vi: 'Vua Bọ Hung', en: 'Beetle King' } },
];

export const pickTxt = (o: Txt, l: Lang) => o[l];
