/**
 * Headless smoke test: boots the built game in Chromium, clicks through
 * Title → Story → Game, simulates play (movement, gnawing, tail-slap,
 * dive, dam building with flood cinematics, leak patching, canal digging,
 * save/continue, journal, lodge tunnel + epilogue) and fails on any page
 * error. Usage: node scripts/smoke.mjs   (after `npm run build`)
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
const fail = (msg) => errors.push(`assert: ${msg}`);
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

  // Title → BEGIN (no save yet, so BEGIN sits at H*0.5)
  await page.mouse.click(640, 360);
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
  // try the context action near whatever is around
  await page.keyboard.down('Space');
  await sleep(1500);
  await page.keyboard.up('Space');
  await sleep(500);
  await page.screenshot({ path: 'scripts/shot-4-play.png' });

  // tail-slap (tap Q afloat) then dive (hold Q in deep water)
  await page.evaluate(() => {
    const gs = window.beaverDan.scene.getScene('Game');
    // teleport to a guaranteed deep tile in the stream channel
    for (let ty = 6; ty < 28; ty++) {
      const tx = gs.world.centerX(ty);
      if (gs.world.isDeepWater(tx, ty)) {
        gs.dan.tx = tx;
        gs.dan.ty = ty;
        gs.dan.reproject();
        break;
      }
    }
  });
  await page.keyboard.down('KeyQ');
  await page.keyboard.up('KeyQ'); // tap = slap
  await sleep(600);
  await page.keyboard.down('KeyQ'); // hold = dive
  await sleep(1500);
  await page.screenshot({ path: 'scripts/shot-5-dive.png' });
  const submerged = await page.evaluate(() => window.beaverDan.scene.getScene('Game').dan.submerged);
  if (!submerged) fail('Dan did not submerge on held Q in deep water');
  await page.keyboard.up('KeyQ');
  await sleep(500);

  // build the dam stage by stage so each flood cinematic can play out
  await page.evaluate(() => {
    const gs = window.beaverDan.scene.getScene('Game');
    const tree = gs.world.trees.find((t) => t.kind === 'aspen' && t.state === 'standing');
    gs.fellTree(tree, gs.treeSprites.get(tree.id));
    gs.objectiveIdx = 2; // buildDam
  });
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => {
      const gs = window.beaverDan.scene.getScene('Game');
      gs.deliverDamLog();
      gs.deliverDamLog();
    });
    if (i === 0) {
      await sleep(2200);
      await page.screenshot({ path: 'scripts/shot-6-floodcine.png' });
    }
    await sleep(6500); // let the cinematic finish
  }
  await page.screenshot({ path: 'scripts/shot-7-pond.png' });

  // spring a leak, walk to it, patch it by holding the action.
  // (Pin the clock to midday and top up energy so wolves/collapse can't
  // teleport Dan mid-hold — the test exercises verbs, not the night.)
  await page.evaluate(() => {
    const gs = window.beaverDan.scene.getScene('Game');
    gs.timeOfDay = 0.3;
    gs.energy = 100;
    for (const w of gs.wolves) w.despawn();
    gs.maybeSpringLeak();
    gs.dan.tx = gs.leak.tx;
    gs.dan.ty = gs.leak.ty;
    gs.dan.reproject();
  });
  await sleep(400);
  await page.screenshot({ path: 'scripts/shot-8-leak.png' });
  // hold until done — headless framerate (and so game-time) varies a lot
  await page.keyboard.down('Space');
  let leakGone = false;
  for (let i = 0; i < 30 && !leakGone; i++) {
    await sleep(500);
    leakGone = await page.evaluate(() => window.beaverDan.scene.getScene('Game').leak === null);
  }
  await page.keyboard.up('Space');
  if (!leakGone) fail('leak was not patched by held action');

  // dig a canal from soft ground beside the pond
  await page.evaluate(() => {
    const gs = window.beaverDan.scene.getScene('Game');
    gs.timeOfDay = 0.3;
    gs.energy = 100;
    for (const wolf of gs.wolves) wolf.despawn();
    const w = gs.world;
    const clear = (tx, ty) =>
      !w.trees.some((t) => t.state !== 'snag' && Math.hypot(t.tx - tx, t.ty - ty) < 2) &&
      !gs.logs.some((l) => Math.hypot(l.tx - tx, l.ty - ty) < 2) &&
      !gs.foods.some((f) => Math.hypot(f.tx - tx, f.ty - ty) < 1.6);
    outer: for (let ty = 8; ty < w.damTy - 2; ty++) {
      for (let dx = 2; dx < 10; dx++) {
        const tx = Math.round(w.centerX(ty)) + dx;
        if (!w.isWater(tx, ty) && w.bordersWater(tx, ty) && w.elevation(tx, ty) < w.baseWater + 1.4 && clear(tx, ty)) {
          gs.dan.tx = tx;
          gs.dan.ty = ty;
          gs.dan.reproject();
          break outer;
        }
      }
    }
  });
  await sleep(300);
  await page.keyboard.down('Space');
  let canals = 0;
  for (let i = 0; i < 30 && canals < 1; i++) {
    await sleep(500);
    canals = await page.evaluate(() => window.beaverDan.scene.getScene('Game').world.canals.length);
  }
  await page.keyboard.up('Space');
  if (canals < 1) fail('canal was not dug by held action');

  // save, reload, CONTINUE — progress must survive
  await page.evaluate(() => window.beaverDan.scene.getScene('Game').autosave());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2500);
  await page.screenshot({ path: 'scripts/shot-9-title-continue.png' });
  await page.mouse.click(640, 360); // CONTINUE
  await sleep(2500);
  const restored = await page.evaluate(() => {
    const gs = window.beaverDan.scene.getScene('Game');
    return { damLogs: gs.damLogs, stage: gs.world.damStage, canals: gs.world.canals.length };
  });
  if (restored.damLogs !== 8 || restored.stage !== 4 || restored.canals < 1) {
    fail(`save did not restore (got ${JSON.stringify(restored)})`);
  }
  await page.screenshot({ path: 'scripts/shot-10-continued.png' });

  // finish the chapter: lodge logs, eat, enter via the tunnel, epilogue
  await page.evaluate(() => {
    const gs = window.beaverDan.scene.getScene('Game');
    for (let i = 0; i < 4; i++) gs.deliverLodgeLog();
    gs.energy = 100;
    gs.enterLodge();
  });
  await sleep(800);
  await page.screenshot({ path: 'scripts/shot-11-tunnel.png' });
  await page.keyboard.down('Space'); // hold to swim up the entrance
  await sleep(2500);
  const rise = await page.evaluate(() => window.beaverDan.scene.getScene('Lodge').rise);
  if (!(rise > 0.03)) fail(`tunnel rise did not respond to held input (rise=${rise})`);
  // headless SwiftShader runs ~4fps with a clamped timestep, so game-time
  // crawls; verify the mechanic responds, then fast-forward the climb
  await page.evaluate(() => (window.beaverDan.scene.getScene('Lodge').rise = 0.99));
  await sleep(1500);
  await page.keyboard.up('Space');
  await sleep(800);
  const phase = await page.evaluate(() => window.beaverDan.scene.getScene('Lodge').phase);
  if (phase !== 'chamber') fail(`lodge tunnel not completed (phase=${phase})`);
  await page.screenshot({ path: 'scripts/shot-12-epilogue.png' });
  for (let i = 0; i < 7; i++) {
    await page.mouse.click(640, 400);
    await sleep(800);
  }
  await sleep(1800);
  const onTitle = await page.evaluate(() => window.beaverDan.scene.isActive('Title'));
  if (!onTitle) fail('did not return to title after the epilogue');
  await page.screenshot({ path: 'scripts/shot-13-back-to-title.png' });

  // the journal must remember what Dan lived
  const journalCount = await page.evaluate(() => JSON.parse(localStorage.getItem('bd-journal') ?? '[]').length);
  if (journalCount < 5) fail(`journal too empty after a full chapter (${journalCount})`);
  await page.mouse.click(640, 436); // FIELD JOURNAL (save cleared, second button)
  await sleep(1200);
  const onJournal = await page.evaluate(() => window.beaverDan.scene.isActive('Journal'));
  if (!onJournal) fail('journal scene did not open from title');
  await page.screenshot({ path: 'scripts/shot-14-journal.png' });
} finally {
  await browser.close();
  server.kill();
}

if (errors.length) {
  console.error('SMOKE TEST FAILED');
  for (const e of [...new Set(errors)]) console.error(' -', e);
  process.exit(1);
}
console.log('SMOKE TEST PASSED — no page errors, all assertions held. Screenshots in scripts/.');
