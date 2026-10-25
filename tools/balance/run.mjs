// `npm run balance [-- --levels 30 --quick]`
// Starts the Vite dev server, opens the game in headless Chromium and lets two bots
// (a good player and a casual one) play: a full campaign with upgrades, then a per-level
// sweep. Prints win rates so a tuning change can be checked in a couple of minutes.
import { createServer } from 'vite';
import { chromium } from 'playwright';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? def : process.argv[i + 1] === undefined || process.argv[i + 1].startsWith('--') ? true : process.argv[i + 1];
};
const maxLevel = +arg('levels', 30);
const quick = !!arg('quick', false);

const server = await createServer({ server: { port: 0 }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(url);
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '–');
  for (const who of ['good', 'casual']) {
    console.log(`\n== ${who} player`);
    const camp = await page.evaluate(
      async ([who, maxLevel]) => {
        const B = await import('/tools/balance/bot.js');
        return B.campaign({ skill: B.SKILLS[who], maxLevel });
      },
      [who, maxLevel],
    );
    const wins = camp.rows.filter((r) => r.win).length;
    const reached = Math.max(...camp.rows.map((r) => r.level));
    const worst = camp.rows.reduce((m, r) => (r.tries > m.tries ? r : m), camp.rows[0]);
    const stars = [1, 2, 3].map((s) => camp.rows.filter((r) => r.win && r.stars === s).length);
    console.log(`campaign: reached level ${reached} in ${camp.rows.length} runs, won ${pct(wins, camp.rows.length)}`);
    console.log(`  stars on wins: ★1 ${stars[0]} · ★2 ${stars[1]} · ★3 ${stars[2]}; toughest: level ${worst.level} (${worst.tries} tries)`);
    console.log(`  upgrades at the end: ${JSON.stringify(camp.upgrades)} · captain ${camp.captain}`);
    if (quick) continue;
    const rows = await page.evaluate(
      async ([who, maxLevel]) => {
        const B = await import('/tools/balance/bot.js');
        return B.sweep({ skill: B.SKILLS[who], maxLevel });
      },
      [who, maxLevel],
    );
    let line = 'first-try wins per level:';
    for (let l = 1; l <= maxLevel; l++) {
      const rs = rows.filter((r) => r.level === l);
      line += ` ${l}:${rs.filter((r) => r.win).length}/${rs.length}`;
    }
    console.log(line);
    for (const [a, b] of [[1, 9], [10, 19], [20, maxLevel]]) {
      const rs = rows.filter((r) => r.level >= a && r.level <= b);
      if (rs.length) console.log(`  levels ${a}-${b}: ${pct(rs.filter((r) => r.win).length, rs.length)}`);
    }
  }
} finally {
  await browser.close();
  await server.close();
}
