export type Lang = 'vi' | 'en';

const dict = {
  title: { vi: 'Kiến Ơi Kiến Ầm!', en: 'Ant Rumble!' },
  play: { vi: 'Chơi', en: 'Play' },
  level: { vi: 'Màn', en: 'Level' },
  daily: { vi: 'Thử thách ngày', en: 'Daily Challenge' },
  nest: { vi: 'Tổ kiến', en: 'Ant Nest' },
  colony: { vi: 'Bộ sưu tập', en: 'Collection' },
  settings: { vi: 'Cài đặt', en: 'Settings' },
  honey: { vi: 'Mật', en: 'Honey' },
  back: { vi: 'Quay lại', en: 'Back' },
  dragHint: { vi: 'Kéo / vuốt để dẫn đàn kiến!', en: 'Drag / swipe to lead the swarm!' },
  keyHint: { vi: '(hoặc phím ← →)', en: '(or ← → keys)' },
  needAnts: { vi: 'Cần {0} kiến!', en: 'Need {0} ants!' },
  carried: { vi: 'Khiêng về tổ! +{0} mật', en: 'Carried home! +{0} honey' },
  bossTime: { vi: 'TRÙM XUẤT HIỆN!', en: 'BOSS FIGHT!' },
  win: { vi: 'Thắng rồi!', en: 'Victory!' },
  lose: { vi: 'Đàn kiến tan rã...', en: 'The swarm scattered...' },
  next: { vi: 'Màn tiếp', en: 'Next level' },
  retry: { vi: 'Chơi lại', en: 'Retry' },
  home: { vi: 'Về menu', en: 'Menu' },
  resume: { vi: 'Tiếp tục', en: 'Resume' },
  paused: { vi: 'Tạm dừng', en: 'Paused' },
  antsLeft: { vi: 'Kiến còn lại', en: 'Ants left' },
  crumbs: { vi: 'Vụn bánh', en: 'Crumbs' },
  bigFood: { vi: 'Mồi to', en: 'Big food' },
  bonus: { vi: 'Thưởng màn', en: 'Level bonus' },
  total: { vi: 'Tổng mật', en: 'Total honey' },
  upgrade: { vi: 'Nâng cấp', en: 'Upgrade' },
  max: { vi: 'TỐI ĐA', en: 'MAX' },
  lv: { vi: 'Cấp', en: 'Lv' },
  equip: { vi: 'Chọn', en: 'Equip' },
  equipped: { vi: 'Đang dùng', en: 'Equipped' },
  buy: { vi: 'Mua', en: 'Buy' },
  captain: { vi: 'Kiến đội trưởng', en: 'Captain ant' },
  language: { vi: 'Ngôn ngữ', en: 'Language' },
  sound: { vi: 'Âm thanh', en: 'Sound' },
  music: { vi: 'Nhạc nền', en: 'Music' },
  on: { vi: 'Bật', en: 'On' },
  off: { vi: 'Tắt', en: 'Off' },
  reset: { vi: 'Xóa dữ liệu', en: 'Reset progress' },
  resetConfirm: { vi: 'Xóa toàn bộ tiến trình?', en: 'Erase all progress?' },
  dailyBest: { vi: 'Kỷ lục hôm nay', en: "Today's best" },
  dailyDone: { vi: 'Điểm', en: 'Score' },
  newBest: { vi: 'KỶ LỤC MỚI!', en: 'NEW BEST!' },
  notEnough: { vi: 'Chưa đủ mật!', en: 'Not enough honey!' },
  tagline: { vi: 'Ăn vụn, nhân đàn, hạ trùm!', en: 'Munch crumbs, grow the swarm, beat the boss!' },
  combo: { vi: 'Combo x{0}!', en: 'Combo x{0}!' },
  dodge: { vi: 'Né!', en: 'Dodge!' },
  stomp: { vi: 'Coi chừng chân!', en: 'Watch the foot!' },
  fever: { vi: 'CUỒNG NHIỆT!', en: 'FEVER!' },
  shield: { vi: 'Khiên bong bóng!', en: 'Bubble shield!' },
  magnet: { vi: 'Siêu nam châm!', en: 'Super magnet!' },
  rage: { vi: 'Kiến nổi giận! x2 sức', en: 'Ant rage! x2 power' },
  blocked: { vi: 'Chặn!', en: 'Blocked!' },
  mystery: { vi: 'Bất ngờ!', en: 'Surprise!' },
  bossDodge: { vi: 'Né sang bên kia!', en: 'Dodge to the other side!' },
  counter: { vi: 'PHẢN ĐÒN!', en: 'COUNTER!' },
  ouch: { vi: 'Ui da!', en: 'Ouch!' },
  stars: { vi: 'Sao', en: 'Stars' },
  starBonus: { vi: 'Thưởng sao', en: 'Star bonus' },
  tipBoss: { vi: 'Mẹo: khi trùm đánh, kéo đàn kiến sang phía an toàn để phản đòn!', en: 'Tip: when the boss strikes, move to the safe side to counter!' },
  rescue: { vi: 'Giải cứu! +{0}', en: 'Rescued! +{0}' },
  dash: { vi: 'TĂNG TỐC!', en: 'DASH!' },
  slotHint: { vi: '🎰 Canh đúng lúc!', en: '🎰 Time it right!' },
  bossRage: { vi: 'TRÙM NỔI ĐIÊN!', en: 'BOSS IS FURIOUS!' },
  milestone: { vi: '{0} KIẾN!', en: '{0} ANTS!' },
  lucky: { vi: 'Nhân thưởng may mắn', en: 'Lucky multiplier' },
  stop: { vi: 'Dừng!', en: 'Stop!' },
  quests: { vi: 'Nhiệm vụ', en: 'Quests' },
  questsSub: { vi: 'Nhiệm vụ mới mỗi ngày!', en: 'New quests every day!' },
  claim: { vi: 'Nhận', en: 'Claim' },
  questDone: { vi: 'Xong nhiệm vụ! Vào 📜 để nhận thưởng', en: 'Quest complete! Claim it in 📜' },
  allQuests: { vi: 'Xong cả 3: thưởng thêm', en: 'All 3 done: extra' },
  giant: { vi: 'KIẾN KHỔNG LỒ! Đạp bẹp hết!', en: 'GIANT ANTS! Stomp everything!' },
  smash: { vi: 'BẸP!', en: 'SQUASH!' },
  bugSpot: { vi: '🐞 Bọ rùa vàng! Đuổi theo!', en: '🐞 Golden ladybug! Catch it!' },
  bugCaught: { vi: 'BẮT ĐƯỢC! +{0} 🍯', en: 'GOTCHA! +{0} 🍯' },
  bugGone: { vi: 'Bay mất rồi...', en: 'It got away...' },
  goldBug: { vi: 'Bọ rùa vàng', en: 'Golden ladybug' },
  revive: { vi: 'Cứu đàn kiến?', en: 'Save the swarm?' },
  reviveSub: { vi: 'Hồi sinh {0} kiến + khiên bong bóng!', en: 'Bring back {0} ants + a bubble shield!' },
  reviveFree: { vi: 'Hồi sinh miễn phí', en: 'Free revive' },
  reviveBtn: { vi: 'Hồi sinh', en: 'Revive' },
  revived: { vi: 'HỒI SINH!', en: 'BACK IN ACTION!' },
  skip: { vi: 'Thôi, bỏ qua', en: 'No thanks' },
  gift: { vi: 'Quà mỗi ngày', en: 'Daily gift' },
  giftSub: { vi: 'Ghé mỗi ngày, quà càng to! Lỡ một ngày là về lại ngày 1.', en: 'Come back daily for bigger gifts! Miss a day and it restarts.' },
  day: { vi: 'Ngày {0}', en: 'Day {0}' },
  open: { vi: 'Mở quà!', en: 'Open!' },
  giftTomorrow: { vi: 'Mai quay lại nhé!', en: 'See you tomorrow!' },
} as const;

export type Key = keyof typeof dict;

let lang: Lang = 'vi';
export const setLang = (l: Lang) => {
  lang = l;
  document.documentElement.lang = l;
};
export const getLang = () => lang;

export function t(key: Key, ...args: (string | number)[]): string {
  let s: string = dict[key][lang];
  args.forEach((a, i) => (s = s.replace(`{${i}}`, String(a))));
  return s;
}

/** Pick from an inline {vi, en} pair. */
export const tr = (o: { vi: string; en: string }) => o[lang];

/** Things the ants (and the boss) shout, picked at random. */
export const CHAT = {
  munch: { vi: ['Măm măm!', 'Ngon quá!', 'Nữa nữa!', 'Hí hí!', 'Thơm ghê!'], en: ['Nom nom!', 'Yummy!', 'More!', 'Hehe!', 'Tasty!'] },
  good: { vi: ['Yeah!', 'Đông vui!', 'Tuyệt!', 'Wiii!', 'Anh em ơi!'], en: ['Yay!', 'Party!', 'Woohoo!', 'Wheee!', 'Buddies!'] },
  bad: { vi: ['Huhu...', 'Ơ kìa!', 'Toang!', 'Mẹ ơi!', 'Sao lại thế!'], en: ['Nooo!', 'Uh-oh!', 'Oops!', 'Mommy!', 'Why?!'] },
  hurt: { vi: ['Ui da!', 'Á á!', 'Đau quá!', 'Cứu!'], en: ['Ouch!', 'Eek!', 'Yikes!', 'Help!'] },
  boss: { vi: ['Xung phong!', 'Đông là thắng!', 'Cắn nó!', 'Lên nào!'], en: ['Charge!', 'Get him!', 'Bite!', 'Go go go!'] },
  win: { vi: ['Hoan hô!', 'Kiến số 1!', 'Về ăn tiệc!', 'Đỉnh quá!'], en: ['Hooray!', 'Ants rule!', 'Party time!', 'We did it!'] },
  rescue: { vi: ['Cảm ơn!', 'Tự do!', 'Ra rồi!'], en: ['Thanks!', 'Free!', "I'm out!"] },
  giant: { vi: ['Ta là khổng lồ!', 'Đạp bẹp!', 'Rầm rầm!'], en: ['I am HUGE!', 'Stomp stomp!', 'Boom boom!'] },
  bug: { vi: ['Bắt lấy!', 'Lấp lánh quá!', 'Đứng lại!'], en: ['Catch it!', 'So shiny!', 'Come back!'] },
  dash: { vi: ['Wiiiii!', 'Nhanh như gió!'], en: ['Wheeee!', 'Zoom zoom!'] },
  taunt: { vi: ['Lũ kiến tí hon!', 'Ta đói rồi!', 'Lại đây nào!', 'Hừ hừ!'], en: ['Puny ants!', "I'm hungry!", 'Come at me!', 'Hmph!'] },
  rage: { vi: ['GRỪ! Tức quá!', 'Hết kiên nhẫn!', 'Chọc giận ta à?!'], en: ['GRR! So angry!', "That's it!", 'You made me MAD!'] },
  bossWin: { vi: ['Ta... thua rồi...', 'Hu hu hu!'], en: ['I... lost...', 'Waaah!'] },
} as const;
export type ChatKind = keyof typeof CHAT;
export const chatLine = (k: ChatKind) => {
  const arr = CHAT[k][lang];
  return arr[Math.floor(Math.random() * arr.length)];
};

/** Hype words for long crumb combos. */
export const COMBO_WORDS: Record<number, { vi: string; en: string }> = {
  5: { vi: 'Ngon!', en: 'Nice!' },
  15: { vi: 'Tuyệt cú mèo!', en: 'Awesome!' },
  25: { vi: 'Đỉnh của chóp!', en: 'Unstoppable!' },
  35: { vi: 'SIÊU KIẾN!', en: 'SUPER ANTS!' },
  45: { vi: 'HUYỀN THOẠI!', en: 'LEGENDARY!' },
};
