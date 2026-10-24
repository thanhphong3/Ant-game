// Long-term goals: lifetime stats, achievements, swarm skins and star chests.
import type { Txt } from './data';

export interface LifeStats {
  runs: number;
  wins: number;
  bosses: number;
  crumbs: number;
  bugs: number;
  maxAnts: number;
  counters: number;
  jars: number;
  smashed: number;
  threeStars: number;
  /** 💀 levels won on the very first try */
  hardFirstTry: number;
  chapters: number;
  dailies: number;
  revives: number;
  quits: number;
}

export const freshLife = (): LifeStats => ({
  runs: 0, wins: 0, bosses: 0, crumbs: 0, bugs: 0, maxAnts: 0, counters: 0, jars: 0, smashed: 0,
  threeStars: 0, hardFirstTry: 0, chapters: 0, dailies: 0, revives: 0, quits: 0,
});

export type SkinId = 'classic' | 'pink' | 'blue' | 'mint' | 'purple' | 'orange' | 'choco';
export const SKINS: { id: SkinId; color: string; name: Txt }[] = [
  { id: 'classic', color: '#3a2d45', name: { vi: 'Kiến đen', en: 'Classic' } },
  { id: 'choco', color: '#7a4a2a', name: { vi: 'Kiến sô-cô-la', en: 'Choco' } },
  { id: 'pink', color: '#e0609e', name: { vi: 'Kiến hồng', en: 'Bubblegum' } },
  { id: 'blue', color: '#3f7fd6', name: { vi: 'Kiến xanh biển', en: 'Ocean' } },
  { id: 'mint', color: '#2fa38a', name: { vi: 'Kiến bạc hà', en: 'Mint' } },
  { id: 'orange', color: '#e8823a', name: { vi: 'Kiến cam', en: 'Tangerine' } },
  { id: 'purple', color: '#7a4fd6', name: { vi: 'Kiến tím mộng mơ', en: 'Dreamy purple' } },
];
export const skinColor = (id: SkinId) => (SKINS.find((s) => s.id === id) ?? SKINS[0]).color;

export interface AchDef {
  id: string;
  icon: string;
  name: Txt;
  desc: Txt; // {0} = goal
  goal: number;
  stat: keyof LifeStats;
  reward: number;
  skin?: SkinId;
}

export const ACHIEVEMENTS: AchDef[] = [
  { id: 'win1', icon: '🏆', name: { vi: 'Trận đầu ra quân', en: 'First victory' }, desc: { vi: 'Thắng {0} màn', en: 'Win {0} level' }, goal: 1, stat: 'wins', reward: 50 },
  { id: 'boss10', icon: '👑', name: { vi: 'Thợ săn trùm', en: 'Boss hunter' }, desc: { vi: 'Hạ {0} trùm', en: 'Beat {0} bosses' }, goal: 10, stat: 'bosses', reward: 300, skin: 'choco' },
  { id: 'boss50', icon: '👑', name: { vi: 'Huyền thoại diệt trùm', en: 'Boss legend' }, desc: { vi: 'Hạ {0} trùm', en: 'Beat {0} bosses' }, goal: 50, stat: 'bosses', reward: 2000 },
  { id: 'crumb1k', icon: '🍞', name: { vi: 'Bụng no căng', en: 'Full belly' }, desc: { vi: 'Ăn {0} vụn bánh', en: 'Munch {0} crumbs' }, goal: 1000, stat: 'crumbs', reward: 200 },
  { id: 'crumb10k', icon: '🍰', name: { vi: 'Dạ dày không đáy', en: 'Bottomless' }, desc: { vi: 'Ăn {0} vụn bánh', en: 'Munch {0} crumbs' }, goal: 10000, stat: 'crumbs', reward: 1500, skin: 'pink' },
  { id: 'swarm200', icon: '🐜', name: { vi: 'Đàn đông vui', en: 'Big crowd' }, desc: { vi: 'Có {0} kiến cùng lúc', en: 'Have {0} ants at once' }, goal: 200, stat: 'maxAnts', reward: 250 },
  { id: 'swarm1000', icon: '🌊', name: { vi: 'Biển kiến', en: 'Sea of ants' }, desc: { vi: 'Có {0} kiến cùng lúc', en: 'Have {0} ants at once' }, goal: 1000, stat: 'maxAnts', reward: 1500, skin: 'blue' },
  { id: 'bug10', icon: '🐞', name: { vi: 'Thợ bắt bọ', en: 'Bug catcher' }, desc: { vi: 'Bắt {0} bọ rùa vàng', en: 'Catch {0} golden ladybugs' }, goal: 10, stat: 'bugs', reward: 300 },
  { id: 'counter50', icon: '💥', name: { vi: 'Võ sư phản đòn', en: 'Counter master' }, desc: { vi: 'Phản đòn trùm {0} lần', en: 'Counter bosses {0} times' }, goal: 50, stat: 'counters', reward: 600, skin: 'orange' },
  { id: 'jar20', icon: '🔓', name: { vi: 'Người giải cứu', en: 'Rescuer' }, desc: { vi: 'Giải cứu {0} hũ kiến', en: 'Free {0} ant jars' }, goal: 20, stat: 'jars', reward: 300 },
  { id: 'smash30', icon: '🍄', name: { vi: 'Khổng lồ dễ thương', en: 'Gentle giant' }, desc: { vi: 'Đạp bẹp {0} chướng ngại', en: 'Squash {0} obstacles' }, goal: 30, stat: 'smashed', reward: 400, skin: 'mint' },
  { id: 'star20', icon: '⭐', name: { vi: 'Ngôi sao sáng', en: 'Shining star' }, desc: { vi: 'Thắng 3 sao {0} lần', en: 'Win with 3 stars {0} times' }, goal: 20, stat: 'threeStars', reward: 600 },
  { id: 'hard3', icon: '💀', name: { vi: 'Không sợ trùm khó', en: 'Fearless' }, desc: { vi: 'Thắng màn 💀 ngay lần đầu {0} lần', en: 'Win a 💀 level first try {0} times' }, goal: 3, stat: 'hardFirstTry', reward: 800, skin: 'purple' },
  { id: 'chapter1', icon: '📖', name: { vi: 'Hết chương 1', en: 'Chapter one' }, desc: { vi: 'Hoàn thành {0} chương', en: 'Finish {0} chapter' }, goal: 1, stat: 'chapters', reward: 400 },
  { id: 'chapter3', icon: '📚', name: { vi: 'Nhà thám hiểm', en: 'Explorer' }, desc: { vi: 'Hoàn thành {0} chương', en: 'Finish {0} chapters' }, goal: 3, stat: 'chapters', reward: 1500 },
  { id: 'daily7', icon: '📅', name: { vi: 'Chăm chỉ mỗi ngày', en: 'Daily devotee' }, desc: { vi: 'Chơi {0} thử thách ngày', en: 'Play {0} daily challenges' }, goal: 7, stat: 'dailies', reward: 500 },
];

/** Achievements reached but not yet claimed. */
export const achReady = (life: LifeStats, claimed: string[]) => ACHIEVEMENTS.filter((a) => life[a.stat] >= a.goal && !claimed.includes(a.id));

/** Star chests open every 15 stars, each a bit bigger. */
export const STARS_PER_CHEST = 15;
export const chestReward = (i: number) => 200 + i * 150;
