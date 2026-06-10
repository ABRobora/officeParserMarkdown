import Phaser from 'phaser';
import { PAL, mix } from '../palette';
import type { GameScene } from './GameScene';

const W = 1280;
const H = 720;
const SERIF = 'Georgia, "Times New Roman", serif';

/**
 * First-person view from inside Dan's lodge: a dark stick dome, the glow
 * of the underwater entrance below, breath misting in the cold air.
 * Sleeping here skips to dawn; the final sleep plays the winter epilogue.
 */
export class LodgeScene extends Phaser.Scene {
  private final = false;

  constructor() {
    super('Lodge');
  }

  init(data: { final?: boolean }): void {
    this.final = !!data.final;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x0c1118);
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
      const txt = this.add.text(
        W / 2,
        H * 0.12,
        'Dry, dark and safe above the waterline.\nThe only doors are under it.',
        { fontFamily: SERIF, fontSize: '24px', color: '#e8dcc0', align: 'center', lineSpacing: 8 }
      ).setOrigin(0.5);
      const tap = this.add.text(W / 2, H * 0.95, 'tap to sleep until dawn', {
        fontFamily: SERIF,
        fontSize: '18px',
        color: '#9c8e74'
      }).setOrigin(0.5);
      this.tweens.add({ targets: tap, alpha: 0.4, duration: 900, yoyo: true, repeat: -1 });
      this.input.once('pointerdown', () => this.sleepAndReturn());
      this.input.keyboard?.once('keydown', () => this.sleepAndReturn());
      void txt;
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

    const showNext = () => {
      if (i >= lines.length) {
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
    showNext();
    this.input.on('pointerdown', showNext);
    this.input.keyboard?.on('keydown', showNext);
  }
}
