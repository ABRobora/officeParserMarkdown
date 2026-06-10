import Phaser from 'phaser';
import { World, Tree } from '../world';
import { Beaver } from '../entities/beaver';
import { Wolf } from '../entities/wolf';
import { isoToScreen, isoDepth, TILE_W, TILE_H, noise2 } from '../iso';
import { PAL, mix, jitter } from '../palette';
import { OBJECTIVES } from '../chapters';

interface LogItem {
  tx: number;
  ty: number;
  sprite: Phaser.GameObjects.Image;
}

interface FoodItem {
  tx: number;
  ty: number;
  sprite: Phaser.GameObjects.Image;
}

type ActionContext =
  | { kind: 'none' }
  | { kind: 'gnaw'; tree: Tree; sprite: Phaser.GameObjects.Image }
  | { kind: 'pickup'; log: LogItem }
  | { kind: 'buildDam' }
  | { kind: 'buildLodge' }
  | { kind: 'enterLodge' }
  | { kind: 'eat'; food?: FoodItem; stump?: Tree };

const DAY_LENGTH = 160; // seconds per in-game day
const SEASONS = ['Late Summer', 'Early Autumn', 'Autumn', 'Late Autumn', 'First Frost'];

export class GameScene extends Phaser.Scene {
  private world!: World;
  private ground!: Phaser.GameObjects.Graphics;
  private damGfx!: Phaser.GameObjects.Graphics;
  private dan!: Beaver;
  private wolf!: Wolf;
  private treeSprites = new Map<number, Phaser.GameObjects.Image>();
  private logs: LogItem[] = [];
  private foods: FoodItem[] = [];
  private lodgeSprite!: Phaser.GameObjects.Image;
  private damMarker!: Phaser.GameObjects.Image;
  private lodgeMarker!: Phaser.GameObjects.Image;

  // input
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private joyX = 0;
  private joyY = 0;
  private actionHeld = false;

  // simulation state
  private timeOfDay = 0.2; // morning
  private day = 1;
  private energy = 100;
  private objectiveIdx = 0;
  private objectiveCount = 0;
  private damLogs = 0;
  private lodgeLogs = 0;
  private gnawTarget: Tree | null = null;
  private gnawProgress = 0;
  private gnawBar!: Phaser.GameObjects.Graphics;
  private rippleTimer = 0;
  private wolfWasHunting = false;
  private shownNotes = new Set<string>();
  private context: ActionContext = { kind: 'none' };
  private ending = false;

  constructor() {
    super('Game');
  }

  create(): void {
    this.world = new World();
    this.shownNotes.clear();
    this.logs = [];
    this.foods = [];
    this.treeSprites.clear();
    this.timeOfDay = 0.2;
    this.day = 1;
    this.energy = 100;
    this.objectiveIdx = 0;
    this.objectiveCount = 0;
    this.damLogs = 0;
    this.lodgeLogs = 0;
    this.ending = false;

    this.cameras.main.setBackgroundColor(mix(PAL.hillNear, 0x000000, 0.45));

    this.ground = this.add.graphics().setDepth(-1000);
    this.drawGround();

    this.damGfx = this.add.graphics();
    this.drawDam();

    // narrows boulders — the landmark Dan is searching for
    const ds = isoToScreen(this.world.damSite.tx, this.world.damSite.ty);
    const hw = this.world.channelHalfWidth(this.world.damTy) + 0.8;
    const b1 = isoToScreen(this.world.damSite.tx - hw, this.world.damTy);
    const b2 = isoToScreen(this.world.damSite.tx + hw, this.world.damTy);
    this.add.image(b1.x, b1.y - 6, 'boulder').setDepth(isoDepth(this.world.damSite.tx - hw, this.world.damTy));
    this.add.image(b2.x, b2.y - 6, 'boulder').setDepth(isoDepth(this.world.damSite.tx + hw, this.world.damTy));

    this.damMarker = this.add
      .image(ds.x, ds.y, 'site-marker')
      .setDepth(isoDepth(this.world.damSite.tx, this.world.damSite.ty) - 1);
    this.tweens.add({ targets: this.damMarker, scale: { from: 0.85, to: 1.15 }, alpha: { from: 0.9, to: 0.5 }, duration: 900, yoyo: true, repeat: -1 });

    const ls = isoToScreen(this.world.lodgeSite.tx, this.world.lodgeSite.ty);
    this.lodgeMarker = this.add
      .image(ls.x, ls.y, 'site-marker')
      .setDepth(isoDepth(this.world.lodgeSite.tx, this.world.lodgeSite.ty) - 1)
      .setVisible(false);
    this.tweens.add({ targets: this.lodgeMarker, scale: { from: 0.85, to: 1.15 }, alpha: { from: 0.9, to: 0.5 }, duration: 900, yoyo: true, repeat: -1 });

    this.lodgeSprite = this.add
      .image(ls.x, ls.y - 14, 'lodge')
      .setOrigin(0.5, 0.78)
      .setDepth(isoDepth(this.world.lodgeSite.tx, this.world.lodgeSite.ty) + 3)
      .setVisible(false);

    for (const tree of this.world.trees) this.addTreeSprite(tree);
    this.sprinkleFlora();

    this.dan = new Beaver(this, this.world);
    this.wolf = new Wolf(this, this.world);
    this.gnawBar = this.add.graphics().setDepth(1e9);

    // camera
    const cam = this.cameras.main;
    const left = isoToScreen(0, this.world.H).x - TILE_W;
    const right = isoToScreen(this.world.W, 0).x + TILE_W;
    const top = -TILE_H * 4;
    const bottom = isoToScreen(this.world.W, this.world.H).y + TILE_H * 4;
    cam.setBounds(left, top, right - left, bottom - top);
    cam.startFollow(this.dan.container, true, 0.09, 0.09);
    cam.setZoom(Math.max(1, Math.min(1.4, this.scale.width / 960)));

    // input
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT,SPACE,E') as Record<string, Phaser.Input.Keyboard.Key>;

    this.game.events.on('joy', this.onJoy, this);
    this.game.events.on('actionState', this.onActionState, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('joy', this.onJoy, this);
      this.game.events.off('actionState', this.onActionState, this);
    });

    this.scene.launch('UI');
    this.publishObjective();
    this.registry.set('day', this.day);
    this.registry.set('season', SEASONS[0]);

    this.time.delayedCall(900, () => this.note('firstSwim'));
  }

  // ---------- world drawing ----------

  private drawGround(): void {
    const g = this.ground;
    g.clear();
    const w = this.world;
    for (let ty = 0; ty < w.H; ty++) {
      for (let tx = 0; tx < w.W; tx++) {
        const e = w.elevation(tx, ty);
        const level = w.waterLevelAt(ty);
        let color: number;
        if (e < level) {
          const depth = Math.min(1, (level - e) / 1.6);
          color = mix(PAL.waterShallow, PAL.waterDeep, depth);
        } else if (e < level + 0.35) {
          color = jitter(PAL.bank, tx * 131 + ty, 0.05);
        } else if (e > 2.6) {
          color = jitter(PAL.forestFloor, tx * 131 + ty, 0.07);
        } else {
          color = jitter(mix(PAL.meadow, PAL.meadowDeep, Math.min(1, e / 3)), tx * 131 + ty, 0.06);
        }
        const p = isoToScreen(tx, ty);
        g.fillStyle(color, 1);
        g.beginPath();
        g.moveTo(p.x, p.y - TILE_H / 2);
        g.lineTo(p.x + TILE_W / 2, p.y);
        g.lineTo(p.x, p.y + TILE_H / 2);
        g.lineTo(p.x - TILE_W / 2, p.y);
        g.closePath();
        g.fillPath();
      }
    }
  }

  private drawDam(): void {
    const g = this.damGfx;
    g.clear();
    const w = this.world;
    if (this.damLogs <= 0) return;
    const cx = w.damSite.tx;
    const ty = w.damTy;
    const span = w.channelHalfWidth(ty) + 0.9;
    const n = Math.min(14, this.damLogs * 2);
    for (let i = 0; i < n; i++) {
      const f = i / Math.max(1, n - 1);
      const tx = cx - span + f * span * 2;
      const p = isoToScreen(tx, ty + (noise2(i, 3) - 0.5) * 0.5);
      const rot = (noise2(i, 9) - 0.5) * 0.9;
      g.fillStyle(jitter(PAL.damWood, i * 7, 0.12), 1);
      g.save();
      g.translateCanvas(p.x, p.y - 6 - (i % 3) * 3);
      g.rotateCanvas(rot);
      g.fillRoundedRect(-16, -4, 32, 8, 4);
      g.restore();
    }
    g.setDepth(isoDepth(cx, ty) + 4);
  }

  private addTreeSprite(tree: Tree): void {
    const tex = tree.state === 'standing' ? `tree-${tree.kind}` : tree.state === 'stump' ? 'stump' : 'snag';
    const p = isoToScreen(tree.tx, tree.ty);
    const img = this.add
      .image(p.x, p.y, tex)
      .setOrigin(0.5, 0.92)
      .setDepth(isoDepth(tree.tx, tree.ty) + 2)
      .setTint(jitter(0xffffff, tree.id * 13, 0.1));
    this.treeSprites.set(tree.id, img);
  }

  private sprinkleFlora(): void {
    const w = this.world;
    for (let i = 0; i < 70; i++) {
      const tx = 2 + noise2(i, 31) * (w.W - 4);
      const ty = 2 + noise2(i, 47) * (w.H - 4);
      const e = w.elevation(tx, ty);
      const level = w.waterLevelAt(Math.round(ty));
      const p = isoToScreen(tx, ty);
      if (e >= level && e < level + 0.4) {
        this.add.image(p.x, p.y - 12, 'reeds').setDepth(isoDepth(tx, ty) + 1).setTint(jitter(0xffffff, i, 0.12));
      } else if (e < level - 0.1 && ty < w.damTy) {
        const lily = this.add.image(p.x, p.y - 2, 'lily').setDepth(isoDepth(tx, ty) + 1);
        this.foods.push({ tx, ty, sprite: lily });
      }
    }
  }

  // ---------- UI plumbing ----------

  private onJoy(v: { x: number; y: number }): void {
    this.joyX = v.x;
    this.joyY = v.y;
  }

  private onActionState(down: boolean): void {
    this.actionHeld = down;
  }

  private note(id: string): void {
    if (this.shownNotes.has(id)) return;
    this.shownNotes.add(id);
    this.game.events.emit('note', id);
  }

  private toast(msg: string): void {
    this.game.events.emit('toast', msg);
  }

  private publishObjective(): void {
    const o = OBJECTIVES[this.objectiveIdx];
    this.registry.set('objective', {
      text: o ? o.text : '',
      hint: o ? o.hint : '',
      n: this.objectiveCount,
      target: o ? o.target : 0
    });
  }

  private advanceObjective(): void {
    this.game.events.emit('objectiveComplete', OBJECTIVES[this.objectiveIdx].id);
    this.objectiveIdx++;
    this.objectiveCount = 0;
    this.publishObjective();
  }

  private objectiveIs(id: string): boolean {
    return OBJECTIVES[this.objectiveIdx]?.id === id;
  }

  // ---------- main loop ----------

  update(_time: number, deltaMs: number): void {
    if (this.ending) return;
    const dt = Math.min(0.05, deltaMs / 1000);

    this.updateClock(dt);
    this.updateMovementInput(dt);
    this.updateContext();
    this.updateAction(dt);
    this.updateNeeds(dt);
    this.updateWolf(dt);
    this.updateAmbience(dt);

    this.registry.set('energy', this.energy);
    this.registry.set('timeOfDay', this.timeOfDay);
  }

  private updateClock(dt: number): void {
    const prev = this.timeOfDay;
    this.timeOfDay += dt / DAY_LENGTH;
    if (this.timeOfDay >= 1) {
      this.timeOfDay -= 1;
      this.day++;
      this.registry.set('day', this.day);
      this.registry.set('season', SEASONS[Math.min(SEASONS.length - 1, this.day - 1)]);
    }
    // dusk: the wolf slips out of the treeline
    if (prev < 0.72 && this.timeOfDay >= 0.72) {
      this.note('nightFall');
      this.wolf.spawnFor(this.dan);
    }
    if (prev < 0.98 && this.timeOfDay >= 0.98) this.wolf.despawn();
  }

  private updateMovementInput(dt: number): void {
    let ix = this.joyX;
    let iy = this.joyY;
    const k = this.keys;
    if (k.A.isDown || k.LEFT.isDown) ix -= 60;
    if (k.D.isDown || k.RIGHT.isDown) ix += 60;
    if (k.W.isDown || k.UP.isDown) iy -= 60;
    if (k.S.isDown || k.DOWN.isDown) iy += 60;
    // gnawing roots Dan in place
    if (this.gnawTarget) {
      ix = 0;
      iy = 0;
    }
    const wasSwimming = this.dan.mode === 'swim';
    this.dan.update(dt, ix, iy);
    if (!wasSwimming && this.dan.mode === 'swim') this.note('firstDive');
  }

  private updateContext(): void {
    const dan = this.dan;
    const w = this.world;
    let ctx: ActionContext = { kind: 'none' };

    // logs first — picking up is the most common intent
    if (!dan.carrying) {
      for (const log of this.logs) {
        if (dan.distTo(log.tx, log.ty) < 1.5) {
          ctx = { kind: 'pickup', log };
          break;
        }
      }
    }

    if (ctx.kind === 'none' && dan.carrying) {
      if (this.objectiveIs('buildDam') && dan.distTo(w.damSite.tx, w.damSite.ty) < 2.4) ctx = { kind: 'buildDam' };
      else if (this.objectiveIs('buildLodge') && dan.distTo(w.lodgeSite.tx, w.lodgeSite.ty) < 2.4) ctx = { kind: 'buildLodge' };
    }

    if (ctx.kind === 'none' && this.lodgeLogs >= 4 && dan.distTo(w.lodgeSite.tx, w.lodgeSite.ty) < 2.2) {
      ctx = { kind: 'enterLodge' };
    }

    if (ctx.kind === 'none' && !dan.carrying) {
      let best: Tree | null = null;
      let bestD = 1.6;
      for (const tree of w.trees) {
        if (tree.state === 'snag') continue;
        const d = dan.distTo(tree.tx, tree.ty);
        if (d < bestD) {
          best = tree;
          bestD = d;
        }
      }
      if (best) {
        if (best.state === 'stump') ctx = { kind: 'eat', stump: best };
        else if (best.kind === 'pine') ctx = { kind: 'none' };
        else ctx = { kind: 'gnaw', tree: best, sprite: this.treeSprites.get(best.id)! };
      }
    }

    if (ctx.kind === 'none' && !dan.carrying) {
      for (const f of this.foods) {
        if (dan.distTo(f.tx, f.ty) < 1.3) {
          ctx = { kind: 'eat', food: f };
          break;
        }
      }
    }

    this.context = ctx;
    const labels: Record<string, string> = {
      none: '',
      gnaw: 'GNAW',
      pickup: 'TAKE LOG',
      buildDam: 'BUILD DAM',
      buildLodge: 'BUILD LODGE',
      enterLodge: 'ENTER LODGE',
      eat: 'EAT'
    };
    this.registry.set('actionLabel', labels[ctx.kind]);
  }

  private updateAction(dt: number): void {
    const pressed =
      this.actionHeld || this.keys.SPACE.isDown || this.keys.E.isDown;

    // --- gnawing is a held action ---
    if (this.context.kind === 'gnaw' && pressed) {
      const tree = this.context.tree;
      if (this.gnawTarget !== tree) {
        this.gnawTarget = tree;
        this.gnawProgress = 0;
        this.note('firstGnaw');
      }
      this.gnawProgress += dt / 2.6;
      this.energy = Math.max(0, this.energy - dt * 2.2);
      const sprite = this.context.sprite;
      sprite.angle = Math.sin(this.time.now / 30) * 1.5;
      if (Math.random() < dt * 14) this.spawnChip(tree);
      this.drawGnawBar();
      if (this.gnawProgress >= 1) this.fellTree(tree, sprite);
      return;
    }
    if (this.gnawTarget) {
      const s = this.treeSprites.get(this.gnawTarget.id);
      if (s) s.angle = 0;
    }
    this.gnawTarget = null;
    this.gnawBar.clear();

    if (!pressed) {
      this.actionConsumed = false;
      return;
    }
    if (this.actionConsumed) return;
    this.actionConsumed = true;

    const ctx = this.context;
    switch (ctx.kind) {
      case 'pickup': {
        this.logs = this.logs.filter((l) => l !== ctx.log);
        ctx.log.sprite.destroy();
        this.dan.setCarrying(true);
        this.note('firstLog');
        break;
      }
      case 'buildDam':
        this.dan.setCarrying(false);
        this.deliverDamLog();
        break;
      case 'buildLodge':
        this.dan.setCarrying(false);
        this.deliverLodgeLog();
        break;
      case 'enterLodge':
        this.enterLodge();
        break;
      case 'eat': {
        const food = ctx.food;
        if (food) {
          food.sprite.destroy();
          this.foods = this.foods.filter((f) => f !== food);
        }
        this.energy = Math.min(100, this.energy + (food ? 35 : 25));
        this.note('firstEat');
        break;
      }
      case 'none':
        break;
    }
  }

  private actionConsumed = false;

  private drawGnawBar(): void {
    const g = this.gnawBar;
    g.clear();
    const p = this.dan.container;
    g.fillStyle(0x14202e, 0.5);
    g.fillRoundedRect(p.x - 22, p.y - 48, 44, 7, 3);
    g.fillStyle(PAL.uiAccent, 1);
    g.fillRoundedRect(p.x - 20, p.y - 46.5, 40 * Math.min(1, this.gnawProgress), 4, 2);
  }

  private spawnChip(tree: Tree): void {
    const p = isoToScreen(tree.tx, tree.ty);
    const chip = this.add
      .image(p.x + (Math.random() - 0.5) * 10, p.y - 12, 'chip')
      .setDepth(isoDepth(tree.tx, tree.ty) + 6);
    this.tweens.add({
      targets: chip,
      x: chip.x + (Math.random() - 0.5) * 30,
      y: p.y + 4,
      angle: (Math.random() - 0.5) * 180,
      alpha: 0,
      duration: 450,
      onComplete: () => chip.destroy()
    });
  }

  private fellTree(tree: Tree, sprite: Phaser.GameObjects.Image): void {
    this.gnawTarget = null;
    this.gnawProgress = 0;
    this.gnawBar.clear();
    tree.state = 'stump';
    const dir = this.dan.tx < tree.tx ? 1 : -1;
    this.tweens.add({
      targets: sprite,
      angle: 80 * dir,
      duration: 700,
      ease: 'Quad.easeIn',
      onComplete: () => {
        sprite.setTexture('stump').setAngle(0).setOrigin(0.5, 0.7);
        for (let i = 0; i < 2; i++) this.spawnLog(tree.tx + (i + 1) * 0.8 * dir, tree.ty + (Math.random() - 0.5));
        // a flurry of leaves
        const p = isoToScreen(tree.tx, tree.ty);
        for (let i = 0; i < 8; i++) {
          const leaf = this.add.image(p.x, p.y - 40, 'leaf').setDepth(isoDepth(tree.tx, tree.ty) + 6);
          this.tweens.add({
            targets: leaf,
            x: p.x + (Math.random() - 0.5) * 80,
            y: p.y + Math.random() * 20,
            angle: Math.random() * 360,
            alpha: 0,
            duration: 900 + Math.random() * 600,
            onComplete: () => leaf.destroy()
          });
        }
      }
    });
    this.cameras.main.shake(120, 0.002);
    this.note('firstFell');
    if (this.objectiveIs('fellTrees')) {
      this.objectiveCount++;
      this.publishObjective();
      if (this.objectiveCount >= 3) this.advanceObjective();
    }
  }

  private spawnLog(tx: number, ty: number): void {
    if (!this.world.inBounds(tx, ty)) return;
    const p = isoToScreen(tx, ty);
    const sprite = this.add.image(p.x, p.y - 4, 'log').setDepth(isoDepth(tx, ty) + 1);
    this.logs.push({ tx, ty, sprite });
  }

  private deliverDamLog(): void {
    this.damLogs++;
    this.objectiveCount = this.damLogs;
    this.publishObjective();
    this.drawDam();
    this.splash(this.world.damSite.tx, this.world.damSite.ty);
    if (this.damLogs === 1) this.note('damStage1');
    if (this.damLogs % 2 === 0) {
      const drowned = this.world.raiseDam();
      this.drawGround();
      for (const t of drowned) {
        const s = this.treeSprites.get(t.id);
        if (s) s.setTexture('snag').setTint(0xffffff).setOrigin(0.5, 0.92);
      }
      if (drowned.length > 0) this.note('firstFlood');
      if (this.world.damStage === 2) this.note('damStage2');
      if (this.world.damStage >= 4) this.note('damStage4');
      this.cameras.main.shake(200, 0.0015);
      this.toast('The water rises…');
      this.addPondLife();
    }
    if (this.damLogs >= 8 && this.objectiveIs('buildDam')) {
      this.advanceObjective();
      this.damMarker.setVisible(false);
      this.lodgeMarker.setVisible(true);
      this.toast('Deep water at last. Now — a lodge.');
    }
  }

  private deliverLodgeLog(): void {
    this.lodgeLogs++;
    this.objectiveCount = this.lodgeLogs;
    this.publishObjective();
    this.lodgeSprite.setVisible(true).setScale(0.35 + this.lodgeLogs * 0.16);
    this.splash(this.world.lodgeSite.tx, this.world.lodgeSite.ty);
    if (this.lodgeLogs >= 4 && this.objectiveIs('buildLodge')) {
      this.lodgeMarker.setVisible(false);
      this.note('lodgeBuilt');
      this.advanceObjective();
      this.toast('Eat well, then sleep — winter is close.');
    }
  }

  private addPondLife(): void {
    // each rise of the pond invites a little more life
    for (let i = 0; i < 6; i++) {
      const tx = this.world.damSite.tx + (Math.random() - 0.5) * 14;
      const ty = this.world.damTy - 2 - Math.random() * 12;
      if (this.world.isWater(tx, ty) && !this.world.isDeepWater(tx, ty)) {
        const p = isoToScreen(tx, ty);
        const lily = this.add.image(p.x, p.y - 2, 'lily').setDepth(isoDepth(tx, ty) + 1).setAlpha(0);
        this.tweens.add({ targets: lily, alpha: 1, duration: 1200 });
        this.foods.push({ tx, ty, sprite: lily });
      }
    }
  }

  private splash(tx: number, ty: number): void {
    const p = isoToScreen(tx, ty);
    for (let i = 0; i < 3; i++) {
      const r = this.add.image(p.x, p.y, 'ripple').setDepth(isoDepth(tx, ty) + 3).setScale(0.4);
      this.tweens.add({
        targets: r,
        scale: 1.6 + i * 0.5,
        alpha: 0,
        duration: 600 + i * 200,
        onComplete: () => r.destroy()
      });
    }
  }

  private enterLodge(): void {
    const ready = this.objectiveIs('prepareWinter') && this.energy >= 85;
    if (this.objectiveIs('prepareWinter') && !ready) {
      this.toast('Dan is still hungry — eat before the long sleep.');
      return;
    }
    this.ending = ready;
    this.scene.sleep('UI');
    this.scene.pause();
    this.scene.launch('Lodge', { final: ready });
    if (ready) this.note('winterComes');
  }

  /** Called by LodgeScene when Dan wakes (non-final sleep). */
  wakeAtDawn(): void {
    this.timeOfDay = 0.04;
    this.day++;
    this.registry.set('day', this.day);
    this.registry.set('season', SEASONS[Math.min(SEASONS.length - 1, this.day - 1)]);
    this.energy = 100;
    this.wolf.despawn();
    this.note('firstSleep');
  }

  private updateNeeds(dt: number): void {
    const moving = Math.abs(this.joyX) > 1 || Math.abs(this.joyY) > 1;
    const drain = this.dan.mode === 'swim' ? 0.22 : moving ? 0.4 : 0.12;
    this.energy = Math.max(0, this.energy - drain * dt);
    if (this.energy <= 0) this.collapse();
  }

  private collapse(): void {
    this.energy = 55;
    this.dan.setCarrying(false);
    this.dan.tx = this.world.spawn.tx;
    this.dan.ty = this.world.spawn.ty;
    this.dan.reproject();
    this.cameras.main.flash(600, 20, 30, 50);
    this.toast('Exhausted, Dan dozes in a bank burrow and wakes upstream.');
    this.note('tailFat');
  }

  private updateWolf(dt: number): void {
    const result = this.wolf.update(dt, this.dan);
    if (result === 'hunting' && !this.wolfWasHunting) {
      this.toast('Something moves in the treeline. Get to deep water!');
      this.game.events.emit('danger', true);
    }
    if (result !== 'hunting' && this.wolfWasHunting) {
      this.game.events.emit('danger', false);
      if (this.dan.mode === 'swim') this.note('wolfEscape');
    }
    this.wolfWasHunting = result === 'hunting';
    if (result === 'caught') {
      this.wolf.despawn();
      this.game.events.emit('danger', false);
      this.wolfWasHunting = false;
      this.energy = Math.max(20, this.energy - 30);
      this.dan.setCarrying(false);
      this.dan.tx = this.world.spawn.tx;
      this.dan.ty = this.world.spawn.ty;
      this.dan.reproject();
      this.cameras.main.flash(700, 120, 30, 30);
      this.toast('A close call! Dan escapes upstream, shaken.');
      this.note('wolfCaught');
    }
  }

  private updateAmbience(dt: number): void {
    // exploration objective — finding the narrows
    if (this.objectiveIs('explore') && this.dan.distTo(this.world.damSite.tx, this.world.damSite.ty) < 5) {
      this.advanceObjective();
      this.toast('Fast water between boulders — a perfect dam site.');
    }
    // swimming ripples
    this.rippleTimer -= dt;
    if (this.dan.mode === 'swim' && this.rippleTimer <= 0 && (Math.abs(this.joyX) > 1 || Math.abs(this.joyY) > 1 || this.keys.W.isDown || this.keys.A.isDown || this.keys.S.isDown || this.keys.D.isDown)) {
      this.rippleTimer = 0.28;
      const p = isoToScreen(this.dan.tx, this.dan.ty);
      const r = this.add.image(p.x, p.y + 2, 'ripple').setDepth(this.dan.container.depth - 1).setScale(0.5);
      this.tweens.add({ targets: r, scale: 1.4, alpha: 0, duration: 700, onComplete: () => r.destroy() });
    }
  }
}
