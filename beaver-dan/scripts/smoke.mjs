/**
 * Headless smoke test: boots the built game in Chromium, clicks through
 * Title → Story → Game, simulates play, and fails on any page error.
 * Usage: node scripts/smoke.mjs   (after `npm run build`)
 */
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer';

const PORT = 4173;

function startServer() {
  const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    stdio: 'pipe',
    cwd: new URL('..', import.meta.url).pathname
  });
  return new Promise((resolve, reject) => {
    proc.stdout.on('data', (d) => {
      if (d.toString().includes('http')) resolve(proc);
    });
    proc.on('error', reject);
    setTimeout(() => resolve(proc), 4000);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = await startServer();
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader']
});
const errors = [];
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    const url = msg.location()?.url ?? '';
    if (msg.type() === 'error' && !url.includes('favicon')) {
      errors.push(`console: ${msg.text()} (${url})`);
    }
  });

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await sleep(2500);
  await page.screenshot({ path: 'scripts/shot-1-title.png' });

  // Title → BEGIN
  await page.mouse.click(640, 403);
  await sleep(1200);
  await page.screenshot({ path: 'scripts/shot-2-story.png' });

  // advance 4 story panels into the game
  for (let i = 0; i < 4; i++) {
    await page.mouse.click(640, 360);
    await sleep(900);
  }
  await sleep(2000);
  await page.screenshot({ path: 'scripts/shot-3-game.png' });

  // swim around: hold keys in different directions
  for (const key of ['KeyS', 'KeyD', 'KeyS', 'KeyA']) {
    await page.keyboard.down(key);
    await sleep(1300);
    await page.keyboard.up(key);
  }
  // try the action key near whatever is around
  await page.keyboard.down('Space');
  await sleep(1500);
  await page.keyboard.up('Space');
  await sleep(500);
  await page.screenshot({ path: 'scripts/shot-4-play.png' });

  // touch joystick path: drag on left half
  await page.mouse.move(300, 500);
  await page.mouse.down();
  await page.mouse.move(340, 460, { steps: 5 });
  await sleep(800);
  await page.mouse.up();
  await sleep(300);
  await page.screenshot({ path: 'scripts/shot-5-joystick.png' });

  // drive the late game directly: fell a tree, build the whole dam + lodge
  await page.evaluate(() => {
    const gs = window.beaverDan.scene.getScene('Game');
    const tree = gs.world.trees.find((t) => t.kind === 'aspen' && t.state === 'standing');
    gs.fellTree(tree, gs.treeSprites.get(tree.id));
    gs.objectiveIdx = 2; // buildDam
    for (let i = 0; i < 8; i++) gs.deliverDamLog();
    gs.dan.tx = gs.world.lodgeSite.tx;
    gs.dan.ty = gs.world.lodgeSite.ty;
    gs.dan.reproject();
  });
  await sleep(1500);
  await page.screenshot({ path: 'scripts/shot-6-pond.png' });

  await page.evaluate(() => {
    const gs = window.beaverDan.scene.getScene('Game');
    for (let i = 0; i < 4; i++) gs.deliverLodgeLog();
    gs.energy = 100;
  });
  await sleep(800);
  await page.screenshot({ path: 'scripts/shot-7-lodge.png' });

  // enter the lodge for the winter epilogue (first-person scene)
  await page.evaluate(() => {
    const gs = window.beaverDan.scene.getScene('Game');
    gs.enterLodge();
  });
  await sleep(1500);
  await page.screenshot({ path: 'scripts/shot-8-epilogue.png' });
  for (let i = 0; i < 7; i++) {
    await page.mouse.click(640, 400);
    await sleep(600);
  }
  await sleep(1500);
  await page.screenshot({ path: 'scripts/shot-9-back-to-title.png' });
} finally {
  await browser.close();
  server.kill();
}

if (errors.length) {
  console.error('SMOKE TEST FAILED');
  for (const e of [...new Set(errors)]) console.error(' -', e);
  process.exit(1);
}
console.log('SMOKE TEST PASSED — no page errors. Screenshots in scripts/.');
