import Phaser from 'phaser';
import { PAL, mix } from '../palette';
import { sfx } from '../audio';
import { clearSave } from '../save';
import type { GameScene } from './GameScene';

const W = 1280;
const H = 720;
const SERIF = 'Georgia, "Times New Roman", serif';

/**
 * First-person: entering the lodge the only way a beaver can — by swimming
 * up through the underwater door. Hold to rise through the dark water
 * toward the glow, surface into the chamber, then sleep (or, on the final
 * night, the winter epilogue).
 */
export class LodgeScene extends Phaser.Scene {
  private final = false;
  private phase: 'tunnel' | 'chamber' = 'tunnel';
  private rise = 0;
  private tunnelLayer!: Phaser.GameObjects.Container;
  private darkness!: Phaser.GameObjects.Image;
  private tunnelDan!: Phaser.GameObjects.Image;
  private prompt!: Phaser.GameObjects.Text;
  private bubbleTimer = 0;
  private spaceKey: Phaser.Input.Keyboard.Key | null = null;

  constructor() {
    super('Lodge');
  }

  init(data: { final?: boolean }): void {
    this.final = !!data.final;
    this.phase = 'tunnel';
    this.rise = 0;
    this.bubbleTimer = 0;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x0c1118);
    this.spaceKey = this.input.keyboard?.addKey('SPACE') ?? null;
    this.buildTunnel();
  }

  // ---------- phase 1: the underwater door ----------

  private buildTunnel(): void {
    this.tunnelLayer = this.add.container(0, 0);
    const g = this.add.graphics();
    // water column, darker the deeper — total scrollable height 2x screen
    const bands = 30;
    for (let i = 0; i < bands; i++) {
      g.fillStyle(mix(0x081019, PAL.waterDeep, i / (bands - 1)), 1);
      g.fillRect(0, (i * H * 2) / bands - H, W, (H * 2) / bands + 2);
    }
    // the glowing chamber door at the top of the climb
    g.fillStyle(0xf2e0b0, 0.16);
    g.fillEllipse(W / 2, -H * 0.82, 560, 300);
    g.fillStyle(0xf2e0b0, 0.3);
    g.fillEllipse(W / 2, -H * 0.84, 330, 180);
    g.fillStyle(0xfff2cc, 0.5);
    g.fillEllipse(W / 2, -H * 0.86, 160, 90);
    // tunnel walls of packed sticks
    g.lineStyle(8, 0x16110c, 1);
    for (let i = 0; i < 14; i++) {
      const lx = 140 + (i % 2) * 30;
      const rx = W - 140 - (i % 2) * 30;
      const y = -H + i * 110;
      g.lineBetween(lx - 60, y, lx + 30, y + 90);
      g.lineBetween(rx + 60, y + 40, rx - 30, y + 120);
    }
    this.tunnelLayer.add(g);

    this.tunnelDan = this.add.image(W / 2, H * 0.62, 'beaver-swim').setScale(2.2).setAngle(-90);
    this.darkness = this.add.image(0, 0, 'px').setOrigin(0).setDisplaySize(W, H).setTint(0x05080d).setAlpha(0.45);

    this.prompt = this.add.text(W / 2, H * 0.9, 'hold anywhere to swim up through the door', {
      fontFamily: SERIF, fontSize: '19px', color: '#cfe3ec'
    }).setOrigin(0.5);
    this.tweens.add({ targets: this.prompt, alpha: 0.4, duration: 900, yoyo: true, repeat: -1 });
  }

  update(_time: number, deltaMs: number): void {
    if (this.phase !== 'tunnel') return;
    const dt = Math.min(0.05, deltaMs / 1000);
    const held = this.input.activePointer.isDown || (this.spaceKey?.isDown ?? false);

    if (held) {
      this.rise = Math.min(1, this.rise + dt / 2.6);
      this.tunnelDan.y = H * 0.62 - Math.sin(this.time.now / 90) * 3;
      this.bubbleTimer -= dt;
      if (this.bubbleTimer <= 0) {
        this.bubbleTimer = 0.3;
        sfx.bubble();
        const b = this.add.circle(W / 2 + (Math.random() - 0.5) * 60, H * 0.6, 3 + Math.random() * 4, 0xcfe3ec, 0.5);
        this.tweens.add({ targets: b, y: b.y - 160, alpha: 0, duration: 900, onComplete: () => b.destroy() });
      }
    }
    // the world slides down as Dan rises; the dark thins as the glow nears
    this.tunnelLayer.y = this.rise * H * 1.1;
    this.darkness.setAlpha(0.45 * (1 - this.rise));

    if (this.rise >= 1) {
      this.phase = 'chamber';
      sfx.splash(true);
      this.cameras.main.flash(350, 244, 232, 200);
      this.tunnelLayer.destroy();
      this.tunnelDan.destroy();
      this.darkness.destroy();
      this.prompt.destroy();
      this.buildChamber();
    }
  }

  // ---------- phase 2: the chamber ----------

  private buildChamber(): void {
    const g = this.add.graphics();

    // dome interior — concentric stick arcs lit from below
    for (let ring = 8; ring >= 1; ring--) {
      const shade = mix(0x14100c, PAL.lodgeWood, ring / 10);
      g.fillStyle(shade, 1);
      g.fillEllipse(W / 2, H * 0.62, W * (0.18 + ring * 0.19), H * (0.16 + ring * 0.18));
    }
    // woven sticks
    g.lineStyle(5, 0x241a10, 1);
    for (let i = 0; i < 26; i++) {
      const a = Math.PI + (i / 25) * Math.PI;
      const x1 = W / 2 + Math.cos(a) * W * 0.12;
      const y1 = H * 0.62 + Math.sin(a) * H * 0.1;
      const x2 = W / 2 + Math.cos(a + (Math.random() - 0.5) * 0.2) * W * 0.55;
      const y2 = H * 0.62 + Math.sin(a) * H * 0.62;
      g.lineBetween(x1, y1, x2, y2);
    }
    // chimney light shaft
    g.fillStyle(0xfff8ea, 0.05);
    g.fillTriangle(W / 2 - 14, 0, W / 2 + 14, 0, W / 2, H * 0.45);

    // underwater entrance pool
    g.fillStyle(mix(PAL.waterDeep, 0x000000, 0.3), 1);
    g.fillEllipse(W / 2, H * 0.86, 360, 110);
    g.fillStyle(PAL.waterShallow, 0.25);
    g.fillEllipse(W / 2, H * 0.84, 280, 70);
    const glow = this.add.ellipse(W / 2, H * 0.85, 300, 80, PAL.waterShallow, 0.12);
    this.tweens.add({ targets: glow, alpha: 0.3, scaleX: 1.06, duration: 1600, yoyo: true, repeat: -1 });

    // Dan, curled on the sleeping shelf
    const dan = this.add.image(W / 2 - 230, H * 0.66, 'beaver').setScale(2.4).setAngle(-8);
    this.tweens.add({ targets: dan, y: dan.y - 4, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const zzz = this.add.image(W / 2 - 160, H * 0.5, 'zzz').setAlpha(0);
    this.tweens.add({ targets: zzz, alpha: 0.8, y: H * 0.44, duration: 1800, yoyo: true, repeat: -1 });

    if (this.final) {
      this.playEpilogue();
    } else {
      this.add.text(
        W / 2,
        H * 0.12,
        'Dry, dark and safe above the waterline.\nThe only doors are under it.',
        { fontFamily: SERIF, fontSize: '24px', color: '#e8dcc0', align: 'center', lineSpacing: 8 }
      ).setOrigin(0.5);
      const tap = this.add.text(W / 2, H * 0.95, 'tap to sleep until dawn (a leak left running will cost the pond)', {
        fontFamily: SERIF,
        fontSize: '17px',
        color: '#9c8e74'
      }).setOrigin(0.5);
      this.tweens.add({ targets: tap, alpha: 0.4, duration: 900, yoyo: true, repeat: -1 });
      // brief delay so the surfacing tap doesn't immediately sleep
      this.time.delayedCall(400, () => {
        this.input.once('pointerdown', () => this.sleepAndReturn());
        this.input.keyboard?.once('keydown', () => this.sleepAndReturn());
      });
    }
  }

  private sleepAndReturn(): void {
    this.cameras.main.fadeOut(700, 8, 12, 20);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const game = this.scene.get('Game') as GameScene;
      game.wakeAtDawn();
      this.scene.stop();
      this.scene.wake('UI');
      this.scene.resume('Game');
    });
  }

  private playEpilogue(): void {
    const lines = [
      'Snow seals the valley. Ice roofs the pond.',
      'But beneath it, Dan swims to a sunken raft of branches —\nthe winter larder he anchored beside the lodge.',
      'The dam holds. The water stays deep, and deep water never freezes solid.',
      'In spring, a stranger will swim up Dan’s stream —\nanother disperser, smelling of far hills. Beavers pair for life.',
      'Herons, frogs and otters are already moving in.\nOne beaver built all of this.',
      'BEAVER DAN\nchapter one complete — to be continued'
    ];
    let i = 0;
    const text = this.add.text(W / 2, H * 0.18, '', {
      fontFamily: SERIF,
      fontSize: '26px',
      color: '#e8dcc0',
      align: 'center',
      lineSpacing: 10,
      wordWrap: { width: 980 }
    }).setOrigin(0.5).setAlpha(0);

    sfx.motifSting(false);
    const showNext = () => {
      if (i >= lines.length) {
        clearSave(); // the chapter is told; the journal remembers
        this.cameras.main.fadeOut(900, 8, 12, 20);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          this.scene.stop('UI');
          this.scene.stop('Game');
          this.scene.start('Title');
        });
        return;
      }
      text.setText(lines[i]).setAlpha(0);
      this.tweens.add({ targets: text, alpha: 1, duration: 700 });
      i++;
    };
    this.time.delayedCall(400, () => {
      showNext();
      this.input.on('pointerdown', showNext);
      this.input.keyboard?.on('keydown', showNext);
    });
  }
}
