// "Show off" card: a square picture of the win, shared through the phone's share sheet.
import { INK, drawAccessory, drawAnt, drawBoss, drawGround, makeAntSprites, rrect, paint, text } from './art';
import { BOSSES, THEMES, type CaptainId } from './data';
import { t, tr } from './i18n';
import type { Level } from './level';

export interface ShareInfo {
  lv: Level;
  stars: number;
  ants: number;
  captain: CaptainId;
  skin: string;
}

function drawCard(info: ShareInfo) {
  const S = 720;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  const k = S / 460;
  ctx.setTransform(k, 0, 0, k, S / 2, S / 2);
  drawGround(ctx, THEMES[info.lv.themeIdx], info.lv.themeIdx, 0, -240, 240, 240);
  // the beaten boss, knocked out
  drawBoss(ctx, info.lv.boss, 0, -40, 0, { hurt: 0, attack: 0, dead: true, rage: false });
  // a happy crowd around the captain
  const spr = makeAntSprites(info.skin);
  const n = Math.min(70, Math.max(12, info.ants));
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996;
    const r = 9 * Math.sqrt(i + 3);
    drawAnt(ctx, spr, Math.cos(a) * r * 1.6, 120 + Math.sin(a) * r * 0.55, Math.sin(i) * 0.4, 16, i);
  }
  const cap = makeAntSprites('#4a3558', 'rgba(255,255,255,0.7)');
  drawAnt(ctx, cap, 0, 118, 0, 40, 0);
  drawAccessory(ctx, info.captain, 0, 118, 40, 0);
  // banner
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  rrect(ctx, 40, 26, S - 80, 150, 30, 3, 1);
  paint(ctx, 'rgba(255,247,232,0.95)', 5);
  const bname = tr(BOSSES.find((b) => b.kind === info.lv.boss)!.name);
  text(ctx, `${t('level')} ${info.lv.num} · ${bname}`, S / 2, 66, 34, '#ff7eb6', INK);
  text(ctx, '★'.repeat(info.stars) + '☆'.repeat(3 - info.stars), S / 2, 112, 54, '#ffd166', INK);
  text(ctx, `🐜 ${info.ants}`, S / 2, 154, 28, '#fff', INK);
  // title ribbon
  ctx.fillStyle = 'rgba(43,34,51,0.85)';
  ctx.fillRect(0, S - 70, S, 70);
  text(ctx, `🐜 ${t('title')}`, S / 2, S - 35, 34, '#ffd166', INK);
  // a sprinkle of confetti
  const cols = ['#ff7eb6', '#7ed6ff', '#b5f27a', '#ffd166', '#c7b3ff'];
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = cols[i % 5];
    ctx.save();
    ctx.translate(((i * 0.618) % 1) * S, 190 + ((i * 0.37) % 1) * (S - 280));
    ctx.rotate(i);
    ctx.fillRect(-6, -3, 12, 6);
    ctx.restore();
  }
  return cv;
}

/** Share the card (phone share sheet), or download it where sharing files isn't supported. */
export async function shareWin(info: ShareInfo): Promise<'shared' | 'saved' | 'cancelled'> {
  const cv = drawCard(info);
  const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, 'image/png'));
  if (!blob) return 'cancelled';
  const url = location.href.split('#')[0];
  const bname = tr(BOSSES.find((b) => b.kind === info.lv.boss)!.name);
  const msg = t('shareText', bname, info.lv.num, info.stars);
  const file = new File([blob], `ant-rumble-level-${info.lv.num}.png`, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text: `${msg} ${url}` });
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  try {
    await navigator.clipboard?.writeText(`${msg} ${url}`);
  } catch {
    /* clipboard blocked: the picture is enough */
  }
  return 'saved';
}
