import Phaser from 'phaser';
import { World, Tree } from '../world';
import { Beaver } from '../entities/beaver';
import { Wolf } from '../entities/wolf';
import { isoToScreen, isoDepth, TILE_W, TILE_H, noise2 } from '../iso';
import { PAL, mix, jitter } from '../palette';
import { OBJECTIVES, objectiveIndex } from '../chapters';
import { sfx } from '../audio';
import { SaveData, saveGame, loadGame, addJournalNote } from '../save';

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
  | { kind: 'patch' }
  | { kind: 'dig' }
  | { kind: 'eat'; food?: FoodItem; stump?: Tree };

/** Hold durations (seconds) for channelled actions. */
const HOLD_TIME: Record<string, number> = { gnaw: 2.6, patch: 1.6, dig: 2.0 };

const DAY_LENGTH = 160; // seconds per in-game day
const SEASONS = ['Late Summer', 'Early Autumn', 'Autumn', 'Late Autumn', 'First Frost'];
const BREATH_TIME = 12; // seconds underwater

export class GameScene extends Phaser.Scene {
  private world!: World;
  private ground!: Phaser.GameObjects.Graphics;
  private damGfx!: Phaser.GameObjects.Graphics;
  private dan!: Beaver;
  private wolves: Wolf[] = [];
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
  private actionConsumed = false;
  private bHeld = false;
  private bHoldTime = 0;
  private bConsumed = false;

  // simulation state
  private timeOfDay = 0.2; // morning
  private day = 1;
  private energy = 100;
  private objectiveIdx = 0;
  private objectiveCount = 0;
  private damLogs = 0;
  private lodgeLogs = 0;
  private holdKind: string | null = null;
  private holdProgress = 0;
  private holdTarget: Tree | null = null;
  private holdBar!: Phaser.GameObjects.Graphics;
  private breath = 1;
  private breathBar!: Phaser.GameObjects.Graphics;
  private rippleTimer = 0;
  private bubbleTimer = 0;
  private wolfWasHunting = false;
  private shownNotes = new Set<string>();
  private context: ActionContext = { kind: 'none' };
  private ending = false;
  private cinematic = false;
  private baseZoom = 1;
  private autosaveTimer = 25;
  private floatToastShown = false;

  // the leak
  private leak: { tx: number; ty: number } | null = null;
  private leakFx: Phaser.GameObjects.Image | null = null;

  private loadRequested = false;

  constructor() {
    super('Game');
  }

  init(data: { load?: boolean }): void {
    this.loadRequested = !!data?.load;
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
    this.cinematic = false;
    this.leak = null;
    this.leakFx = null;
    this.floatToastShown = false;
    this.wolfWasHunting = false;

    const save = this.loadRequested ? loadGame() : null;
    if (save) this.applySaveToWorld(save);

    sfx.stopMotif();
    sfx.startWater();

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
    this.wolves = [new Wolf(this, this.world), new Wolf(this, this.world)];
    this.holdBar = this.add.graphics().setDepth(1e9);
    this.breathBar = this.add.graphics().setDepth(1e9);

    if (save) this.applySaveToScene(save);

    // camera
    const cam = this.cameras.main;
    const left = isoToScreen(0, this.world.H).x - TILE_W;
    const right = isoToScreen(this.world.W, 0).x + TILE_W;
    const top = -TILE_H * 4;
    const bottom = isoToScreen(this.world.W, this.world.H).y + TILE_H * 4;
    cam.setBounds(left, top, right - left, bottom - top);
    cam.startFollow(this.dan.container, true, 0.09, 0.09);
    this.baseZoom = Math.max(1, Math.min(1.4, this.scale.width / 960));
    cam.setZoom(this.baseZoom);

    // input
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT,SPACE,E,Q,SHIFT') as Record<string, Phaser.Input.Keyboard.Key>;

    this.game.events.on('joy', this.onJoy, this);
    this.game.events.on('actionState', this.onActionState, this);
    this.game.events.on('bState', this.onBState, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('joy', this.onJoy, this);
      this.game.events.off('actionState', this.onActionState, this);
      this.game.events.off('bState', this.onBState, this);
      sfx.stopWater();
      sfx.stopTrickle();
    });

    this.scene.launch('UI');
    this.publishObjective();
    this.registry.set('day', this.day);
    this.registry.set('season', SEASONS[Math.min(SEASONS.length - 1, this.day - 1)]);

    if (!save) this.time.delayedCall(900, () => this.note('firstSwim'));
  }

  // ---------- save / load ----------

  private buildSave(): SaveData {
    return {
      v: 1,
      objectiveIdx: this.objectiveIdx,
      objectiveCount: this.objectiveCount,
      damLogs: this.damLogs,
      lodgeLogs: this.lodgeLogs,
      damStage: this.world.damStage,
      energy: this.energy,
      day: this.day,
      timeOfDay: this.timeOfDay,
      dan: { tx: this.dan.tx, ty: this.dan.ty, carrying: this.dan.carrying },
      trees: this.world.trees.filter((t) => t.state !== 'standing').map((t) => ({ id: t.id, state: t.state })),
      logs: this.logs.map((l) => ({ tx: l.tx, ty: l.ty })),
      canals: this.world.canals.map((c) => ({ tx: c.tx, ty: c.ty })),
      notes: [...this.shownNotes]
    };
  }

  private autosave(): void {
    if (!this.ending) saveGame(this.buildSave());
  }

  /** Pre-sprite world restoration (terrain, trees, dam). */
  private applySaveToWorld(save: SaveData): void {
    this.world.damStage = save.damStage;
    this.world.visualStage = save.damStage;
    for (const c of save.canals) this.world.digCanal(c.tx, c.ty);
    const byId = new Map(this.world.trees.map((t) => [t.id, t]));
    for (const s of save.trees) {
      const tree = byId.get(s.id);
      if (tree) tree.state = s.state;
    }
    this.objectiveIdx = save.objectiveIdx;
    this.objectiveCount = save.objectiveCount;
    this.damLogs = save.damLogs;
    this.lodgeLogs = save.lodgeLogs;
    this.energy = save.energy;
    this.day = save.day;
    this.timeOfDay = save.timeOfDay;
    this.shownNotes = new Set(save.notes);
  }

  /** Post-sprite restoration (Dan, loose logs, lodge growth). */
  private applySaveToScene(save: SaveData): void {
    this.dan.tx = save.dan.tx;
    this.dan.ty = save.dan.ty;
    this.dan.setCarrying(save.dan.carrying);
    this.dan.reproject();
    for (const l of save.logs) this.spawnLog(l.tx, l.ty);
    if (this.lodgeLogs > 0) this.lodgeSprite.setVisible(true).setScale(0.35 + this.lodgeLogs * 0.16);
    if (this.objectiveIdx > objectiveIndex('buildDam')) {
      this.damMarker.setVisible(false);
      this.lodgeMarker.setVisible(this.objectiveIdx === objectiveIndex('buildLodge'));
    }
  }

  // ---------- world drawing ----------

  private isWaterVisual(tx: number, ty: number): boolean {
    return this.world.elevation(tx, ty) < this.world.waterLevelVisualAt(Math.round(ty));
  }

  private drawGround(): void {
    const g = this.ground;
    g.clear();
    const w = this.world;
    for (let ty = 0; ty < w.H; ty++) {
      for (let tx = 0; tx < w.W; tx++) {
        const e = w.elevation(tx, ty);
        const level = w.waterLevelVisualAt(ty);
        const p = isoToScreen(tx, ty);
        let color: number;
        const isWater = e < level;
        if (isWater) {
          const depth = Math.min(1, (level - e) / 1.6);
          color = mix(PAL.waterShallow, PAL.waterDeep, depth);
        } else if (e < level + 0.35) {
          color = jitter(PAL.bank, tx * 131 + ty, 0.05);
        } else if (e > 2.6) {
          color = jitter(PAL.forestFloor, tx * 131 + ty, 0.07);
        } else {
          color = jitter(mix(PAL.meadow, PAL.meadowDeep, Math.min(1, e / 3)), tx * 131 + ty, 0.06);
        }
        g.fillStyle(color, 1);
        g.beginPath();
        g.moveTo(p.x, p.y - TILE_H / 2);
        g.lineTo(p.x + TILE_W / 2, p.y);
        g.lineTo(p.x, p.y + TILE_H / 2);
        g.lineTo(p.x - TILE_W / 2, p.y);
        g.closePath();
        g.fillPath();

        // pale shoreline rim where water meets land — reads as gentle foam
        if (isWater) {
          g.lineStyle(2, PAL.ripple, 0.4);
          if (!this.isWaterVisual(tx, ty - 1)) g.lineBetween(p.x, p.y - TILE_H / 2, p.x + TILE_W / 2, p.y);
          if (!this.isWaterVisual(tx - 1, ty)) g.lineBetween(p.x - TILE_W / 2, p.y, p.x, p.y - TILE_H / 2);
          if (!this.isWaterVisual(tx + 1, ty)) g.lineBetween(p.x + TILE_W / 2, p.y, p.x, p.y + TILE_H / 2);
          if (!this.isWaterVisual(tx, ty + 1)) g.lineBetween(p.x, p.y + TILE_H / 2, p.x - TILE_W / 2, p.y);
        }
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
      .setOrigin(0.5, tree.state === 'stump' ? 0.7 : 0.92)
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

  private onBState(down: boolean): void {
    this.bHeld = down;
  }

  private note(id: string): void {
    addJournalNote(id);
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
      text: o ? o.text : 'Tend the valley',
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
    this.autosave();
  }

  private objectiveIs(id: string): boolean {
    return OBJECTIVES[this.objectiveIdx]?.id === id;
  }

  private pastObjective(id: string): boolean {
    return this.objectiveIdx > objectiveIndex(id);
  }

  // ---------- main loop ----------

  update(_time: number, deltaMs: number): void {
    if (this.ending) return;
    const dt = Math.min(0.05, deltaMs / 1000);

    if (!this.cinematic) {
      this.updateClock(dt);
      this.updateMovementInput(dt);
      this.updateContext();
      this.updateAction(dt);
      this.updateBAction(dt);
      this.updateNeeds(dt);
      this.updateWolves(dt);
      this.updateLeak(dt);
      this.updateLogDrift(dt);
      this.updateAmbience(dt);

      this.autosaveTimer -= dt;
      if (this.autosaveTimer <= 0) {
        this.autosaveTimer = 25;
        this.autosave();
      }
    } else {
      this.dan.update(dt, 0, 0);
    }

    this.registry.set('energy', this.energy);
    this.registry.set('timeOfDay', this.timeOfDay);
  }

  private updateClock(dt: number): void {
    const prev = this.timeOfDay;
    this.timeOfDay += dt / DAY_LENGTH;
    if (this.timeOfDay >= 1) {
      this.timeOfDay -= 1;
      this.startNewDay();
    }
    // dusk: wolves slip out of the treeline, and dams start to whisper
    if (prev < 0.72 && this.timeOfDay >= 0.72) {
      this.note('nightFall');
      sfx.motifSting(true);
      this.wolves[0].spawnFor(this.dan);
      if (this.day >= 3) this.wolves[1].spawnFor(this.dan); // later nights hunt in pairs
      this.maybeSpringLeak();
    }
    if (prev < 0.98 && this.timeOfDay >= 0.98) {
      for (const w of this.wolves) w.despawn();
    }
  }

  private startNewDay(): void {
    this.day++;
    this.registry.set('day', this.day);
    this.registry.set('season', SEASONS[Math.min(SEASONS.length - 1, this.day - 1)]);
    sfx.motifSting(false);
    this.resolveLeakAtDawn();
    this.autosave();
  }

  private updateMovementInput(dt: number): void {
    let ix = this.joyX;
    let iy = this.joyY;
    const k = this.keys;
    if (k.A.isDown || k.LEFT.isDown) ix -= 60;
    if (k.D.isDown || k.RIGHT.isDown) ix += 60;
    if (k.W.isDown || k.UP.isDown) iy -= 60;
    if (k.S.isDown || k.DOWN.isDown) iy += 60;
    // channelled actions root Dan in place
    if (this.holdKind) {
      ix = 0;
      iy = 0;
    }
    this.dan.update(dt, ix, iy);
  }

  private updateContext(): void {
    const dan = this.dan;
    const w = this.world;
    let ctx: ActionContext = { kind: 'none' };

    if (dan.submerged) {
      this.context = ctx;
      this.registry.set('actionLabel', '');
      this.registry.set('bLabel', 'release to SURFACE');
      return;
    }

    // the leak outranks everything: it is loud, urgent and close-range
    if (this.leak && dan.distTo(this.leak.tx, this.leak.ty) < 1.6) {
      ctx = { kind: 'patch' };
    }

    if (ctx.kind === 'none' && !dan.carrying) {
      for (const log of this.logs) {
        if (dan.distTo(log.tx, log.ty) < 1.5) {
          ctx = { kind: 'pickup', log };
          break;
        }
      }
    }

    if (ctx.kind === 'none' && dan.carrying) {
      const damReachable = this.objectiveIs('buildDam') || (this.pastObjective('buildDam') && this.damLogs < 8);
      if (damReachable && dan.distTo(w.damSite.tx, w.damSite.ty) < 2.4) ctx = { kind: 'buildDam' };
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

    // lowest priority: soft wet ground beside water can be dug into a canal
    if (
      ctx.kind === 'none' &&
      !dan.carrying &&
      dan.mode === 'walk' &&
      this.pastObjective('fellTrees') &&
      w.bordersWater(dan.tx, dan.ty) &&
      w.elevation(dan.tx, dan.ty) < w.baseWater + 1.4
    ) {
      ctx = { kind: 'dig' };
    }

    this.context = ctx;
    const labels: Record<string, string> = {
      none: '',
      gnaw: 'GNAW',
      pickup: 'TAKE LOG',
      buildDam: 'BUILD DAM',
      buildLodge: 'BUILD LODGE',
      enterLodge: 'ENTER LODGE',
      patch: 'PATCH LEAK',
      dig: 'DIG CANAL',
      eat: 'EAT'
    };
    this.registry.set('actionLabel', labels[ctx.kind]);
    // B-verb label: slap anywhere afloat; dive only in deep water
    const inWater = dan.mode === 'swim';
    this.registry.set('bLabel', inWater ? (w.isDeepWater(dan.tx, dan.ty) ? 'SLAP · hold: DIVE' : 'TAIL SLAP') : '');
  }

  // ---------- A action (context verb) ----------

  private updateAction(dt: number): void {
    const pressed = this.actionHeld || this.keys.SPACE.isDown || this.keys.E.isDown;
    const kind = this.context.kind;

    // channelled actions: gnaw / patch / dig
    if (pressed && (kind === 'gnaw' || kind === 'patch' || kind === 'dig')) {
      if (this.holdKind !== kind) {
        this.holdKind = kind;
        this.holdProgress = 0;
        this.holdTarget = kind === 'gnaw' && this.context.kind === 'gnaw' ? this.context.tree : null;
        if (kind === 'gnaw') this.note('firstGnaw');
      }
      this.holdProgress += dt / HOLD_TIME[kind];
      this.energy = Math.max(0, this.energy - dt * (kind === 'gnaw' ? 2.2 : 1.6));
      if (kind === 'gnaw' && this.context.kind === 'gnaw') {
        this.context.sprite.angle = Math.sin(this.time.now / 30) * 1.5;
        if (Math.random() < dt * 14) {
          this.spawnChip(this.context.tree);
          sfx.gnaw(this.holdProgress);
        }
      }
      if (kind !== 'gnaw' && Math.random() < dt * 6) sfx.mud();
      this.drawHoldBar();
      if (this.holdProgress >= 1) {
        const ctx = this.context;
        this.clearHold();
        if (ctx.kind === 'gnaw') this.fellTree(ctx.tree, ctx.sprite);
        else if (ctx.kind === 'patch') this.patchLeak();
        else if (ctx.kind === 'dig') this.digCanal();
      }
      return;
    }
    this.clearHold();

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
        sfx.splash();
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
        sfx.eat();
        this.note('firstEat');
        break;
      }
      case 'gnaw':
      case 'patch':
      case 'dig':
      case 'none':
        break;
    }
  }

  private clearHold(): void {
    if (this.holdKind === 'gnaw' && this.holdTarget) {
      const s = this.treeSprites.get(this.holdTarget.id);
      if (s) s.angle = 0;
    }
    this.holdKind = null;
    this.holdProgress = 0;
    this.holdTarget = null;
    this.holdBar.clear();
  }

  private drawHoldBar(): void {
    const g = this.holdBar;
    g.clear();
    const p = this.dan.container;
    g.fillStyle(0x14202e, 0.5);
    g.fillRoundedRect(p.x - 22, p.y - 48, 44, 7, 3);
    g.fillStyle(PAL.uiAccent, 1);
    g.fillRoundedRect(p.x - 20, p.y - 46.5, 40 * Math.min(1, this.holdProgress), 4, 2);
  }

  // ---------- B action (tail-slap / dive) ----------

  private updateBAction(dt: number): void {
    const pressed = this.bHeld || this.keys.Q.isDown || this.keys.SHIFT.isDown;
    const dan = this.dan;
    const inDeep = this.world.isDeepWater(dan.tx, dan.ty);

    if (dan.submerged) {
      this.breath -= dt / BREATH_TIME;
      this.bubbleTimer -= dt;
      if (this.bubbleTimer <= 0) {
        this.bubbleTimer = 0.5;
        sfx.bubble();
        this.splashAt(dan.tx, dan.ty, 1);
      }
      this.drawBreathBar();
      // surface on release, on running out of breath, or on leaving deep water
      if (!pressed || this.breath <= 0 || !inDeep) this.surface();
      return;
    }
    this.breathBar.clear();

    if (pressed) {
      this.bHoldTime += dt;
      // held long enough in deep water → submerge
      if (this.bHoldTime > 0.3 && inDeep && !dan.carrying && !this.bConsumed) {
        this.bConsumed = true;
        this.breath = 1;
        dan.setSubmerged(true);
        sfx.dive();
        this.splashAt(dan.tx, dan.ty, 2);
        this.note('firstDive');
      }
    } else {
      // a short press afloat = tail-slap
      if (this.bHoldTime > 0 && this.bHoldTime <= 0.3 && dan.mode === 'swim') this.tailSlap();
      this.bHoldTime = 0;
      this.bConsumed = false;
    }
  }

  private surface(): void {
    this.dan.setSubmerged(false);
    this.breathBar.clear();
    this.splashAt(this.dan.tx, this.dan.ty, 2);
    sfx.splash();
    this.bConsumed = true; // require release before next dive
  }

  private drawBreathBar(): void {
    const g = this.breathBar;
    g.clear();
    const p = this.dan.container;
    g.fillStyle(0x14202e, 0.5);
    g.fillRoundedRect(p.x - 22, p.y - 48, 44, 7, 3);
    g.fillStyle(PAL.waterShallow, 1);
    g.fillRoundedRect(p.x - 20, p.y - 46.5, 40 * Math.max(0, this.breath), 4, 2);
  }

  private tailSlap(): void {
    sfx.tailSlap();
    this.cameras.main.shake(90, 0.0015);
    this.splashAt(this.dan.tx, this.dan.ty, 4);
    this.energy = Math.max(0, this.energy - 1.5);
    let scared = false;
    for (const w of this.wolves) {
      if (w.active && Math.hypot(w.tx - this.dan.tx, w.ty - this.dan.ty) < 18) {
        w.scare();
        scared = true;
      }
    }
    if (scared) {
      this.toast('The crack rolls across the water — the hunter thinks better of it.');
      this.game.events.emit('danger', false);
      this.wolfWasHunting = false;
    }
    this.note('wolfEscape');
  }

  // ---------- felling, building, digging ----------

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
    tree.state = 'stump';
    const dir = this.dan.tx < tree.tx ? 1 : -1;
    sfx.treeFall();
    this.tweens.add({
      targets: sprite,
      angle: 80 * dir,
      duration: 700,
      ease: 'Quad.easeIn',
      onComplete: () => {
        sprite.setTexture('stump').setAngle(0).setOrigin(0.5, 0.7);
        let floated = false;
        for (let i = 0; i < 2; i++) {
          const lx = tree.tx + (i + 1) * 0.8 * dir;
          const ly = tree.ty + (Math.random() - 0.5);
          this.spawnLog(lx, ly);
          if (this.world.isWater(lx, ly)) floated = true;
        }
        if (floated) {
          sfx.splash(true);
          this.note('firstFloat');
        }
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

  /** Loose logs in water drift downstream toward the narrows — the river hauls for you. */
  private updateLogDrift(dt: number): void {
    const w = this.world;
    for (const log of [...this.logs]) {
      if (!w.isWater(log.tx, log.ty)) continue;
      const cx = w.centerX(log.ty);
      const nx = log.tx + Math.max(-1, Math.min(1, cx - log.tx)) * 0.4 * dt;
      const ny = log.ty + 0.45 * dt;
      if (w.isWater(nx, log.ty)) log.tx = nx;
      if (w.isWater(log.tx, ny) && ny < w.damTy - 0.8) log.ty = ny;

      // arrived at the dam: the current has made the delivery
      if (log.ty >= w.damTy - 1.6 && Math.abs(log.tx - w.damSite.tx) < 2.5) {
        const canBuild = (this.objectiveIs('buildDam') || (this.pastObjective('buildDam') && this.damLogs < 8)) && this.damLogs < 8;
        if (canBuild) {
          this.logs = this.logs.filter((l) => l !== log);
          log.sprite.destroy();
          if (!this.floatToastShown) {
            this.floatToastShown = true;
            this.toast('The current delivers your log to the narrows.');
          }
          this.deliverDamLog();
          continue;
        }
      }
      const p = isoToScreen(log.tx, log.ty);
      log.sprite.setPosition(p.x, p.y - 4).setDepth(isoDepth(log.tx, log.ty) + 1);
    }
  }

  private deliverDamLog(): void {
    this.damLogs++;
    if (this.objectiveIs('buildDam')) {
      this.objectiveCount = this.damLogs;
      this.publishObjective();
    }
    this.drawDam();
    this.splashAt(this.world.damSite.tx, this.world.damSite.ty, 3);
    sfx.splash(true);
    if (this.damLogs === 1) this.note('damStage1');
    if (this.damLogs % 2 === 0 && this.world.damStage < 4) {
      const drowned = this.world.raiseDam();
      this.playFloodCinematic(drowned);
    }
    if (this.damLogs >= 8 && this.objectiveIs('buildDam')) {
      this.advanceObjective();
      this.damMarker.setVisible(false);
      this.lodgeMarker.setVisible(true);
      this.toast('Deep water at last. Now — a lodge.');
    }
    this.autosave();
  }

  /**
   * The payoff moment, staged like one: the camera lifts away, the water
   * sweeps outward over several seconds, drowned trees gray into snags one
   * by one, then Dan gets the valley back.
   */
  private playFloodCinematic(drowned: Tree[]): void {
    this.cinematic = true;
    this.clearHold();
    this.game.events.emit('cinematic', true);
    sfx.floodSwell();

    const cam = this.cameras.main;
    const focus = isoToScreen(this.world.damSite.tx, this.world.damTy - 6);
    cam.stopFollow();
    cam.pan(focus.x, focus.y, 900, 'Sine.easeInOut');
    cam.zoomTo(this.baseZoom * 0.72, 900, 'Sine.easeInOut');

    let lastDraw = 0;
    this.tweens.add({
      targets: this.world,
      visualStage: this.world.damStage,
      delay: 700,
      duration: 3000,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        // redraw the ground at most every 70 ms — plenty for a slow sweep
        if (this.time.now - lastDraw > 70) {
          lastDraw = this.time.now;
          this.drawGround();
        }
      },
      onComplete: () => this.drawGround()
    });

    drowned.forEach((t, i) => {
      this.time.delayedCall(1400 + i * 350, () => {
        const s = this.treeSprites.get(t.id);
        if (s) s.setTexture('snag').setTint(0xffffff).setOrigin(0.5, 0.92);
        this.splashAt(t.tx, t.ty, 2);
        sfx.splash();
      });
    });

    this.time.delayedCall(4200, () => {
      cam.zoomTo(this.baseZoom, 800, 'Sine.easeInOut');
      cam.once(Phaser.Cameras.Scene2D.Events.ZOOM_COMPLETE, () => {
        cam.startFollow(this.dan.container, true, 0.09, 0.09);
        this.cinematic = false;
        this.game.events.emit('cinematic', false);
        this.autosave();
      });
      if (drowned.length > 0) this.note('firstFlood');
      if (this.world.damStage === 2) this.note('damStage2');
      if (this.world.damStage >= 4) this.note('damStage4');
      this.toast('The water rises…');
      this.addPondLife();
    });
  }

  private deliverLodgeLog(): void {
    this.lodgeLogs++;
    this.objectiveCount = this.lodgeLogs;
    this.publishObjective();
    this.lodgeSprite.setVisible(true).setScale(0.35 + this.lodgeLogs * 0.16);
    this.splashAt(this.world.lodgeSite.tx, this.world.lodgeSite.ty, 3);
    sfx.splash(true);
    if (this.lodgeLogs >= 4 && this.objectiveIs('buildLodge')) {
      this.lodgeMarker.setVisible(false);
      this.note('lodgeBuilt');
      this.advanceObjective();
      this.toast('Eat well, then sleep — winter is close.');
    }
    this.autosave();
  }

  private digCanal(): void {
    const tx = Math.round(this.dan.tx);
    const ty = Math.round(this.dan.ty);
    this.world.digCanal(tx, ty);
    this.drawGround();
    this.splashAt(tx, ty, 3);
    sfx.mud();
    sfx.splash(true);
    this.energy = Math.max(0, this.energy - 6);
    this.note('firstCanal');
    this.autosave();
  }

  private addPondLife(): void {
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

  private splashAt(tx: number, ty: number, rings: number): void {
    const p = isoToScreen(tx, ty);
    for (let i = 0; i < rings; i++) {
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

  // ---------- the leak ----------

  private maybeSpringLeak(): void {
    if (this.leak || this.world.damStage < 1) return;
    const w = this.world;
    const span = w.channelHalfWidth(w.damTy) + 0.6;
    const tx = w.damSite.tx + (Math.random() * 2 - 1) * span;
    const ty = w.damTy + 0.6;
    this.leak = { tx, ty };
    const p = isoToScreen(tx, ty);
    this.leakFx = this.add.image(p.x, p.y, 'ripple').setDepth(isoDepth(tx, ty) + 5).setTint(PAL.ripple);
    this.tweens.add({
      targets: this.leakFx,
      scale: { from: 0.4, to: 1.1 },
      alpha: { from: 0.95, to: 0.2 },
      duration: 700,
      repeat: -1
    });
    sfx.startTrickle();
    this.toast('You hear trickling water. Beavers cannot leave that sound alone.');
  }

  private patchLeak(): void {
    if (!this.leak) return;
    this.leak = null;
    this.leakFx?.destroy();
    this.leakFx = null;
    sfx.stopTrickle();
    sfx.mud();
    sfx.splash(true);
    this.splashAt(this.world.damSite.tx, this.world.damTy, 3);
    this.energy = Math.max(0, this.energy - 4);
    this.toast('Mud and sticks. Silence. Better.');
    this.note('firstPatch');
    this.autosave();
  }

  /** Sleep through a leak — or ignore it until dawn — and the pond pays. */
  private resolveLeakAtDawn(): void {
    if (!this.leak) return;
    this.leak = null;
    this.leakFx?.destroy();
    this.leakFx = null;
    sfx.stopTrickle();
    this.world.lowerDam();
    this.damLogs = Math.max(0, this.damLogs - 2);
    this.drawGround();
    this.drawDam();
    this.toast('The leak tore wider overnight. The pond has dropped — the dam needs wood.');
  }

  private updateLeak(dt: number): void {
    if (!this.leak) return;
    const d = this.dan.distTo(this.leak.tx, this.leak.ty);
    sfx.setTrickleVolume((1 - Math.min(1, d / 14)) * 0.35);
  }

  // ---------- lodge, needs, wolves ----------

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
  }

  /** Called by LodgeScene when Dan wakes (non-final sleep). */
  wakeAtDawn(): void {
    this.timeOfDay = 0.04;
    this.startNewDay();
    this.energy = 100;
    for (const w of this.wolves) w.despawn();
    this.note('firstSleep');
  }

  private updateNeeds(dt: number): void {
    const moving = Math.abs(this.joyX) > 1 || Math.abs(this.joyY) > 1;
    const drain = this.dan.submerged ? 0.3 : this.dan.mode === 'swim' ? 0.22 : moving ? 0.4 : 0.12;
    this.energy = Math.max(0, this.energy - drain * dt);
    if (this.energy <= 0) this.collapse();
  }

  private collapse(): void {
    this.energy = 55;
    if (this.dan.carrying) {
      this.spawnLog(this.dan.tx, this.dan.ty);
      this.dan.setCarrying(false);
    }
    this.dan.setSubmerged(false);
    this.dan.tx = this.world.spawn.tx;
    this.dan.ty = this.world.spawn.ty;
    this.dan.reproject();
    this.cameras.main.flash(600, 20, 30, 50);
    this.toast('Exhausted, Dan dozes in a bank burrow and wakes upstream.');
    this.note('tailFat');
  }

  private updateWolves(dt: number): void {
    let hunting = false;
    let caught = false;
    for (const wolf of this.wolves) {
      const result = wolf.update(dt, this.dan);
      if (result === 'hunting') hunting = true;
      if (result === 'caught') caught = true;
    }
    if (hunting && !this.wolfWasHunting) {
      sfx.growl();
      this.toast('Something moves in the treeline. Deep water — the shallows are not safe!');
      this.game.events.emit('danger', true);
    }
    if (!hunting && this.wolfWasHunting) {
      this.game.events.emit('danger', false);
    }
    this.wolfWasHunting = hunting;
    if (caught) {
      for (const w of this.wolves) w.despawn();
      this.game.events.emit('danger', false);
      this.wolfWasHunting = false;
      this.energy = Math.max(20, this.energy - 30);
      if (this.dan.carrying) {
        this.spawnLog(this.dan.tx, this.dan.ty); // the log is dropped where the teeth closed
        this.dan.setCarrying(false);
      }
      this.dan.setSubmerged(false);
      this.dan.tx = this.world.spawn.tx;
      this.dan.ty = this.world.spawn.ty;
      this.dan.reproject();
      this.cameras.main.flash(700, 120, 30, 30);
      this.toast('A close call! Dan escapes upstream, shaken — without his log.');
      this.note('wolfCaught');
    }
  }

  private updateAmbience(dt: number): void {
    if (this.objectiveIs('explore') && this.dan.distTo(this.world.damSite.tx, this.world.damSite.ty) < 5) {
      this.advanceObjective();
      this.toast('Fast water between boulders — a perfect dam site.');
    }
    this.rippleTimer -= dt;
    const moving = Math.abs(this.joyX) > 1 || Math.abs(this.joyY) > 1 || this.keys.W.isDown || this.keys.A.isDown || this.keys.S.isDown || this.keys.D.isDown;
    if (this.dan.mode === 'swim' && !this.dan.submerged && this.rippleTimer <= 0 && moving) {
      this.rippleTimer = 0.28;
      const p = isoToScreen(this.dan.tx, this.dan.ty);
      const r = this.add.image(p.x, p.y + 2, 'ripple').setDepth(this.dan.container.depth - 1).setScale(0.5);
      this.tweens.add({ targets: r, scale: 1.4, alpha: 0, duration: 700, onComplete: () => r.destroy() });
    }
  }
}
