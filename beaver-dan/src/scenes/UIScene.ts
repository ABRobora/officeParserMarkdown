import Phaser from 'phaser';
import { PAL, mix } from '../palette';
import { FIELD_NOTES } from '../facts';
import { sfx } from '../audio';

const W = 1280;
const H = 720;
const SERIF = 'Georgia, "Times New Roman", serif';

/**
 * HUD overlay: objective card, energy, clock, virtual joystick + two touch
 * verbs (context action, tail-slap/dive), field-note cards, the day/night
 * light wash, and cinematic letterboxing for the flood sweep.
 */
export class UIScene extends Phaser.Scene {
  private nightRect!: Phaser.GameObjects.Image;
  private dangerRect!: Phaser.GameObjects.Image;
  private objCard!: Phaser.GameObjects.Container;
  private objectiveTitle!: Phaser.GameObjects.Text;
  private objectiveHint!: Phaser.GameObjects.Text;
  private objectiveProgress!: Phaser.GameObjects.Text;
  private clockText!: Phaser.GameObjects.Text;
  private energyFill!: Phaser.GameObjects.Graphics;
  private actionBtn!: Phaser.GameObjects.Container;
  private actionLabel!: Phaser.GameObjects.Text;
  private bBtn!: Phaser.GameObjects.Container;
  private bLabel!: Phaser.GameObjects.Text;
  private muteBtn!: Phaser.GameObjects.Text;
  private joyBase!: Phaser.GameObjects.Arc;
  private joyKnob!: Phaser.GameObjects.Arc;
  private joyPointerId: number | null = null;
  private joyOrigin = { x: 0, y: 0 };
  private noteQueue: string[] = [];
  private noteShowing = false;
  private danger = false;
  private barTop!: Phaser.GameObjects.Image;
  private barBottom!: Phaser.GameObjects.Image;

  constructor() {
    super('UI');
  }

  create(): void {
    this.noteQueue = [];
    this.noteShowing = false;
    this.danger = false;

    this.nightRect = this.add
      .image(0, 0, 'px')
      .setOrigin(0)
      .setDisplaySize(W, H)
      .setTint(PAL.nightShade)
      .setAlpha(0);
    this.dangerRect = this.add
      .image(0, 0, 'px')
      .setOrigin(0)
      .setDisplaySize(W, H)
      .setTint(PAL.uiBad)
      .setAlpha(0);
    // a soft painterly vignette pulls the frame together
    this.add.image(W / 2, H / 2, 'vignette').setAlpha(0.5);

    // cinematic letterbox bars (slide in during the flood sweep)
    this.barTop = this.add.image(0, -64, 'px').setOrigin(0).setDisplaySize(W, 64).setTint(0x101820);
    this.barBottom = this.add.image(0, H, 'px').setOrigin(0).setDisplaySize(W, 64).setTint(0x101820);

    this.buildObjectiveCard();
    this.buildStatusBar();
    this.buildTouchControls();

    const g = this.game.events;
    g.on('note', this.queueNote, this);
    g.on('toast', this.showToast, this);
    g.on('danger', this.setDanger, this);
    g.on('objectiveComplete', this.celebrate, this);
    g.on('cinematic', this.setCinematic, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      g.off('note', this.queueNote, this);
      g.off('toast', this.showToast, this);
      g.off('danger', this.setDanger, this);
      g.off('objectiveComplete', this.celebrate, this);
      g.off('cinematic', this.setCinematic, this);
    });

    this.registry.events.on('changedata', this.onData, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.registry.events.off('changedata', this.onData, this)
    );
    this.refreshObjective();
  }

  // ---------- pieces ----------

  private buildObjectiveCard(): void {
    const card = this.add.graphics();
    card.fillStyle(PAL.uiCard, 0.92);
    card.fillRoundedRect(16, 14, 390, 84, 14);
    card.fillStyle(PAL.uiAccent, 1);
    card.fillRoundedRect(16, 14, 6, 84, 3);
    this.objectiveTitle = this.add.text(36, 24, '', {
      fontFamily: SERIF,
      fontSize: '19px',
      color: '#3a3328',
      fontStyle: 'bold',
      wordWrap: { width: 330 }
    });
    this.objectiveHint = this.add.text(36, 50, '', {
      fontFamily: SERIF,
      fontSize: '14px',
      color: '#7a6f5c',
      wordWrap: { width: 330 }
    });
    this.objectiveProgress = this.add.text(380, 24, '', {
      fontFamily: SERIF,
      fontSize: '19px',
      color: '#d9803e',
      fontStyle: 'bold'
    }).setOrigin(1, 0);
    this.objCard = this.add.container(0, 0, [card, this.objectiveTitle, this.objectiveHint, this.objectiveProgress]);
  }

  private buildStatusBar(): void {
    const g = this.add.graphics();
    g.fillStyle(PAL.uiCard, 0.92);
    g.fillRoundedRect(W - 286, 14, 270, 52, 14);
    // tail icon
    g.fillStyle(PAL.beaverTail, 1);
    g.fillEllipse(W - 258, 40, 26, 16);
    g.lineStyle(1.5, mix(PAL.beaverTail, 0xffffff, 0.25), 1);
    g.strokeEllipse(W - 258, 40, 18, 10);
    // energy trough
    g.fillStyle(0xded3bd, 1);
    g.fillRoundedRect(W - 236, 32, 130, 16, 8);
    this.energyFill = this.add.graphics();
    this.clockText = this.add.text(W - 96, 40, '', {
      fontFamily: SERIF,
      fontSize: '15px',
      color: '#7a6f5c'
    }).setOrigin(0.5);

    this.muteBtn = this.add.text(W - 24, 92, sfx.muted ? '🔇' : '🔊', { fontSize: '24px' })
      .setOrigin(1, 0)
      .setAlpha(0.8)
      .setInteractive({ useHandCursor: true });
    this.muteBtn.on('pointerdown', () => {
      sfx.unlock();
      sfx.setMuted(!sfx.muted);
      this.muteBtn.setText(sfx.muted ? '🔇' : '🔊');
    });
  }

  private buildTouchControls(): void {
    this.joyBase = this.add.circle(0, 0, 54, 0xffffff, 0.12).setStrokeStyle(2, 0xffffff, 0.25).setVisible(false);
    this.joyKnob = this.add.circle(0, 0, 24, 0xffffff, 0.22).setVisible(false);

    // A: context action
    const btn = this.add.circle(0, 0, 52, PAL.uiAccent, 0.85).setStrokeStyle(3, 0xfff8ea, 0.7);
    this.actionLabel = this.add.text(0, 0, '', {
      fontFamily: SERIF,
      fontSize: '15px',
      color: '#fff8ea',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: 86 }
    }).setOrigin(0.5);
    this.actionBtn = this.add.container(W - 92, H - 92, [btn, this.actionLabel]).setAlpha(0.25);
    btn.setInteractive(new Phaser.Geom.Circle(0, 0, 60), Phaser.Geom.Circle.Contains);
    btn.on('pointerdown', () => this.game.events.emit('actionState', true));
    btn.on('pointerup', () => this.game.events.emit('actionState', false));
    btn.on('pointerout', () => this.game.events.emit('actionState', false));

    // B: tail-slap (tap) / dive (hold) — water verbs
    const bCircle = this.add.circle(0, 0, 42, PAL.waterDeep, 0.85).setStrokeStyle(3, 0xfff8ea, 0.6);
    this.bLabel = this.add.text(0, 0, '', {
      fontFamily: SERIF,
      fontSize: '12px',
      color: '#fff8ea',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: 72 }
    }).setOrigin(0.5);
    this.bBtn = this.add.container(W - 92, H - 210, [bCircle, this.bLabel]).setAlpha(0.25);
    bCircle.setInteractive(new Phaser.Geom.Circle(0, 0, 50), Phaser.Geom.Circle.Contains);
    bCircle.on('pointerdown', () => this.game.events.emit('bState', true));
    bCircle.on('pointerup', () => this.game.events.emit('bState', false));
    bCircle.on('pointerout', () => this.game.events.emit('bState', false));

    // left-half drag = joystick (kept clear of the objective card up top)
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      sfx.unlock();
      if (p.x > W * 0.55 || p.y < 120 || this.joyPointerId !== null) return;
      this.joyPointerId = p.id;
      this.joyOrigin = { x: p.x, y: p.y };
      this.joyBase.setPosition(p.x, p.y).setVisible(true);
      this.joyKnob.setPosition(p.x, p.y).setVisible(true);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id !== this.joyPointerId) return;
      let dx = p.x - this.joyOrigin.x;
      let dy = p.y - this.joyOrigin.y;
      const len = Math.hypot(dx, dy);
      const max = 54;
      if (len > max) {
        dx = (dx / len) * max;
        dy = (dy / len) * max;
      }
      this.joyKnob.setPosition(this.joyOrigin.x + dx, this.joyOrigin.y + dy);
      this.game.events.emit('joy', { x: dx, y: dy });
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (p.id !== this.joyPointerId) return;
      this.joyPointerId = null;
      this.joyBase.setVisible(false);
      this.joyKnob.setVisible(false);
      this.game.events.emit('joy', { x: 0, y: 0 });
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
  }

  // ---------- data binding ----------

  private onData(_parent: unknown, key: string): void {
    if (key === 'objective') this.refreshObjective();
  }

  private refreshObjective(): void {
    const o = this.registry.get('objective') as
      | { text: string; hint: string; n: number; target: number }
      | undefined;
    if (!o) return;
    this.objectiveTitle.setText(o.text);
    this.objectiveHint.setText(o.hint);
    this.objectiveProgress.setText(o.target > 0 ? `${o.n}/${o.target}` : '');
  }

  update(): void {
    const t = (this.registry.get('timeOfDay') as number) ?? 0.2;
    this.nightRect.setAlpha(nightAlpha(t));

    const energy = (this.registry.get('energy') as number) ?? 100;
    this.energyFill.clear();
    const col = energy > 40 ? PAL.uiGood : energy > 18 ? PAL.uiAccent : PAL.uiBad;
    this.energyFill.fillStyle(col, 1);
    this.energyFill.fillRoundedRect(W - 234, 34.5, Math.max(6, 126 * (energy / 100)), 11, 5);

    const day = (this.registry.get('day') as number) ?? 1;
    const season = (this.registry.get('season') as string) ?? '';
    this.clockText.setText(`Night ${day}\n${season}`).setAlign('center');

    const label = (this.registry.get('actionLabel') as string) ?? '';
    this.actionLabel.setText(label);
    this.actionBtn.setAlpha(label ? 1 : 0.22);

    const bLabel = (this.registry.get('bLabel') as string) ?? '';
    this.bLabel.setText(bLabel);
    this.bBtn.setAlpha(bLabel ? 1 : 0.18);

    if (this.danger) {
      this.dangerRect.setAlpha(0.08 + Math.sin(this.time.now / 140) * 0.05);
    }
  }

  private setDanger(on: boolean): void {
    this.danger = on;
    if (!on) this.dangerRect.setAlpha(0);
  }

  private setCinematic(on: boolean): void {
    this.tweens.add({ targets: this.barTop, y: on ? 0 : -64, duration: 500, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: this.barBottom, y: on ? H - 64 : H, duration: 500, ease: 'Sine.easeInOut' });
    this.tweens.add({
      targets: [this.objCard, this.actionBtn, this.bBtn],
      alpha: on ? 0 : 1,
      duration: 400
    });
  }

  private celebrate(): void {
    const tick = this.add.text(211, 110, '✓ done', {
      fontFamily: SERIF,
      fontSize: '26px',
      color: '#6fae7e',
      fontStyle: 'bold'
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({
      targets: tick,
      alpha: { from: 0, to: 1 },
      y: 96,
      duration: 400,
      yoyo: true,
      hold: 700,
      onComplete: () => tick.destroy()
    });
  }

  // ---------- field notes & toasts ----------

  private queueNote(id: string): void {
    this.noteQueue.push(id);
    this.maybeShowNote();
  }

  private maybeShowNote(): void {
    if (this.noteShowing || this.noteQueue.length === 0) return;
    const note = FIELD_NOTES[this.noteQueue.shift()!];
    if (!note) {
      this.maybeShowNote();
      return;
    }
    this.noteShowing = true;
    sfx.chime();

    const cw = 620;
    const bodyText = this.make.text({
      x: 0,
      y: 0,
      text: note.body,
      style: { fontFamily: SERIF, fontSize: '16px', color: '#4a4236', wordWrap: { width: cw - 56 }, lineSpacing: 4 },
      add: false
    });
    const ch = 74 + bodyText.height;

    const card = this.add.container(W / 2, -ch);
    const bg = this.add.graphics();
    bg.fillStyle(PAL.uiCard, 0.97);
    bg.fillRoundedRect(-cw / 2, 0, cw, ch, 16);
    bg.fillStyle(PAL.uiGood, 1);
    bg.fillRoundedRect(-cw / 2, 0, cw, 8, { tl: 16, tr: 16, bl: 0, br: 0 });
    const tag = this.add.text(-cw / 2 + 28, 20, 'FIELD NOTE', {
      fontFamily: SERIF,
      fontSize: '12px',
      color: '#8fae5a',
      fontStyle: 'bold'
    });
    const title = this.add.text(-cw / 2 + 28, 38, note.title, {
      fontFamily: SERIF,
      fontSize: '21px',
      color: '#3a3328',
      fontStyle: 'bold'
    });
    bodyText.setPosition(-cw / 2 + 28, 68);
    card.add([bg, tag, title, bodyText]);

    this.tweens.add({ targets: card, y: 18, duration: 450, ease: 'Back.easeOut' });
    const dismiss = () => {
      this.tweens.add({
        targets: card,
        y: -ch - 10,
        duration: 350,
        ease: 'Quad.easeIn',
        onComplete: () => {
          card.destroy();
          this.noteShowing = false;
          this.maybeShowNote();
        }
      });
    };
    bg.setInteractive(new Phaser.Geom.Rectangle(-cw / 2, 0, cw, ch), Phaser.Geom.Rectangle.Contains);
    bg.once('pointerdown', dismiss);
    this.time.delayedCall(8000, () => {
      if (card.active) dismiss();
    });
  }

  private showToast(msg: string): void {
    const t = this.add.text(W / 2, H - 150, msg, {
      fontFamily: SERIF,
      fontSize: '18px',
      color: '#fff8ea',
      backgroundColor: 'rgba(20,32,46,0.75)',
      padding: { x: 18, y: 10 }
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({
      targets: t,
      alpha: 1,
      y: H - 160,
      duration: 300,
      hold: 2600,
      yoyo: true,
      onComplete: () => t.destroy()
    });
  }
}

/** Light wash over the world by time of day (0 = dawn). */
export function nightAlpha(t: number): number {
  if (t < 0.08) return 0.55 * (1 - t / 0.08); // dawn fading
  if (t < 0.62) return 0; // daylight
  if (t < 0.72) return ((t - 0.62) / 0.1) * 0.55; // dusk
  return 0.55; // night
}
