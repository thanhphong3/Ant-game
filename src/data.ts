import type { Lang } from './i18n';

export type Txt = { vi: string; en: string };

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

export const upgradeCost = (u: UpgradeDef, lvl: number) => Math.round(u.baseCost * Math.pow(1.55, lvl));

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
  { name: { vi: 'Phòng tắm', en: 'Bathroom' }, bg: '#e6f6ff', bg2: '#c4e6f8', side: '#9ad7c8', edge: '#4aa3c7' },
  { name: { vi: 'Tủ lạnh', en: 'Fridge' }, bg: '#f4fbff', bg2: '#d3ecf8', side: '#b9def0', edge: '#7fb8d6' },
  { name: { vi: 'Sân trường', en: 'Schoolyard' }, bg: '#ea9a72', bg2: '#fff7ec', side: '#86c96e', edge: '#c45c3a' },
];

/** Ten levels make a chapter, each with its own home turf and a crowned boss at the end. */
export const CHAPTERS: { name: Txt; theme: number }[] = [
  { name: { vi: 'Buổi picnic náo loạn', en: 'Picnic panic' }, theme: 0 },
  { name: { vi: 'Căn bếp bí ẩn', en: 'Kitchen mysteries' }, theme: 1 },
  { name: { vi: 'Phòng tắm trơn trượt', en: 'Slippery bathroom' }, theme: 5 },
  { name: { vi: 'Tủ lạnh băng giá', en: 'Frosty fridge' }, theme: 6 },
  { name: { vi: 'Sân trường ồn ào', en: 'Noisy schoolyard' }, theme: 7 },
  { name: { vi: 'Vườn sau nhà', en: 'Backyard jungle' }, theme: 2 },
  { name: { vi: 'Xứ kẹo ngọt', en: 'Candy kingdom' }, theme: 4 },
];
export const chapterOf = (level: number) => Math.ceil(level / 10);
export const chapterDef = (ch: number) => CHAPTERS[(ch - 1) % CHAPTERS.length];
/** Home turf on even levels and the finale; the rest roam the themes unlocked so far. */
export function levelTheme(level: number) {
  const ch = chapterOf(level);
  if (level % 2 === 0) return chapterDef(ch).theme;
  const pool = ch === 1 ? 5 : THEMES.length;
  return (Math.floor(level / 2) + ch) % pool;
}

export type BossKind = 'spider' | 'frog' | 'lizard' | 'mantis' | 'bee' | 'beetleKing';
export const BOSSES: { kind: BossKind; name: Txt }[] = [
  { kind: 'spider', name: { vi: 'Nhện Lông Lá', en: 'Fuzzy Spider' } },
  { kind: 'frog', name: { vi: 'Ếch Háu Ăn', en: 'Hungry Frog' } },
  { kind: 'lizard', name: { vi: 'Thằn Lằn Lém Lỉnh', en: 'Sneaky Gecko' } },
  { kind: 'mantis', name: { vi: 'Bọ Ngựa Võ Sĩ', en: 'Kung-fu Mantis' } },
  { kind: 'bee', name: { vi: 'Ong Chúa Cáu Kỉnh', en: 'Grumpy Queen Bee' } },
  { kind: 'beetleKing', name: { vi: 'Vua Bọ Hung', en: 'Beetle King' } },
];

export const pickTxt = (o: Txt, l: Lang) => o[l];

/** Each boss's signature attack, shouted as it winds up. */
export const BOSS_MOVES: Record<BossKind, { icon: string; name: Txt; hint: Txt }> = {
  spider: { icon: '🕸️', name: { vi: 'Lưới tơ', en: 'Web drop' }, hint: { vi: 'Lưới rơi ngay đầu: chạy ra khỏi bóng!', en: 'The web drops right on you: run out from under it!' } },
  frog: { icon: '👅', name: { vi: 'Lưỡi dài', en: 'Tongue lash' }, hint: { vi: 'Lưỡi quét gần hết sân: chạy hẳn sang mép bên kia!', en: 'The tongue sweeps most of the arena: run to the far edge!' } },
  lizard: { icon: '🦎', name: { vi: 'Quất đuôi', en: 'Tail whip' }, hint: { vi: 'Đuôi quét 3 nhịp: lách vào chỗ vừa bị đập!', en: 'Three beats: slip in behind the sweep!' } },
  mantis: { icon: '⚔️', name: { vi: 'Song đao', en: 'Scissor slash' }, hint: { vi: 'Hai mép bị chém: trốn vào giữa!', en: 'Both edges get slashed: hide in the middle!' } },
  bee: { icon: '🐝', name: { vi: 'Mưa kim', en: 'Stinger rain' }, hint: { vi: 'Tìm khe hở giữa các mũi kim!', en: 'Find a gap between the stingers!' } },
  beetleKing: { icon: '🪨', name: { vi: 'Động đất', en: 'Earthquake' }, hint: { vi: 'Cả sân rung: chui vào ô an toàn!', en: 'The whole arena shakes: squeeze into the safe spot!' } },
};
