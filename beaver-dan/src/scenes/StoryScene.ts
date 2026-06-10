import Phaser from 'phaser';
import { PAL, mix } from '../palette';

const W = 1280;
const H = 720;
const SERIF = 'Georgia, "Times New Roman", serif';

interface Panel {
  text: string;
  paint: (g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) => void;
}

/**
 * Prologue vignettes — Dan's first two years told in four painted panels,
 * ending at the moment of dispersal where play begins.
 */
export class StoryScene extends Phaser.Scene {
  constructor() {
    super('Story');
  }

  create(): void {
    const panels: Panel[] = [
      {
        text:
          'Two springs ago, Dan was born inside a lodge —\n' +
          'a stick fortress with doors only under the water.\n' +
          'Dark. Dry. Safe.',
        paint: (g) => {
          g.fillGradientStyle(0x0c1118, 0x0c1118, 0x241a10, 0x241a10, 1);
          g.fillRect(0, 0, W, H);
          for (let r = 6; r >= 1; r--) {
            g.fillStyle(mix(0x14100c, PAL.lodgeWood, r / 8), 1);
            g.fillEllipse(W / 2, H * 0.7, W * (0.15 + r * 0.14), H * (0.14 + r * 0.13));
          }
          g.fillStyle(mix(PAL.waterDeep, 0x000000, 0.25), 1);
          g.fillEllipse(W / 2, H * 0.9, 380, 100);
          g.fillStyle(PAL.beaverFur, 1);
          g.fillEllipse(W / 2 - 60, H * 0.68, 70, 40);
          g.fillEllipse(W / 2 + 30, H * 0.7, 46, 28);
          g.fillEllipse(W / 2 + 90, H * 0.68, 46, 28);
        }
      },
      {
        text:
          'Kits stay two whole years. Dan groomed his little sisters,\n' +
          'hauled mud for his mother, and learned the family trade:\n' +
          'if you hear trickling water, fix it.',
        paint: (g) => {
          g.fillGradientStyle(PAL.skyTop, PAL.skyTop, PAL.skyBottom, PAL.skyBottom, 1);
          g.fillRect(0, 0, W, H * 0.55);
          g.fillStyle(PAL.hillMid, 1);
          g.fillEllipse(W * 0.25, H * 0.55, W * 0.9, H * 0.45);
          g.fillStyle(PAL.hillNear, 1);
          g.fillEllipse(W * 0.85, H * 0.6, W * 0.8, H * 0.4);
          g.fillStyle(PAL.waterDeep, 1);
          g.fillRect(0, H * 0.55, W, H * 0.45);
          g.fillStyle(PAL.waterShallow, 0.5);
          g.fillEllipse(W * 0.5, H * 0.62, W * 0.7, 30);
          g.fillStyle(PAL.damWood, 1);
          for (let i = 0; i < 16; i++) {
            g.fillRoundedRect(W * 0.2 + i * 44, H * 0.55 - 14 + (i % 3) * 6, 50, 12, 6);
          }
        }
      },
      {
        text:
          'Then came the night every young beaver knows.\n' +
          'Two years old — time to leave, alone, to find a stream\n' +
          'with no beaver in it. They call it dispersal.\n' +
          'More beavers are lost on this walk than on any other.',
        paint: (g) => {
          g.fillGradientStyle(PAL.duskTop, PAL.duskTop, PAL.duskBottom, PAL.duskBottom, 1);
          g.fillRect(0, 0, W, H);
          g.fillStyle(0xf2d8a0, 0.9);
          g.fillCircle(W * 0.72, H * 0.3, 46);
          g.fillStyle(mix(PAL.nightShade, PAL.duskBottom, 0.3), 1);
          g.fillEllipse(W * 0.3, H * 0.95, W * 1.2, H * 0.55);
          g.fillEllipse(W * 0.9, H * 1.0, W * 1.1, H * 0.5);
          // tiny silhouette trudging the ridge
          g.fillStyle(0x14101c, 1);
          g.fillEllipse(W * 0.42, H * 0.69, 34, 16);
          g.fillCircle(W * 0.435 + 12, H * 0.675, 7);
          g.fillEllipse(W * 0.405, H * 0.7, 14, 6);
          // pines
          for (const [px, s] of [[0.1, 1], [0.16, 0.7], [0.88, 0.9], [0.95, 0.6]] as const) {
            g.fillTriangle(W * px - 28 * s, H * 0.78, W * px + 28 * s, H * 0.78, W * px, H * 0.78 - 130 * s);
          }
        }
      },
      {
        text:
          'Tonight, at last, Dan smells fresh water.\n' +
          'A valley with a winding stream, aspen on the banks,\n' +
          'and no beaver in it.\n\nHome — if he can build it.',
        paint: (g) => {
          g.fillGradientStyle(0x2a3550, 0x2a3550, PAL.duskBottom, PAL.duskBottom, 1);
          g.fillRect(0, 0, W, H * 0.6);
          g.fillStyle(PAL.hillFar, 0.6);
          g.fillEllipse(W * 0.5, H * 0.58, W * 1.3, H * 0.3);
          g.fillStyle(mix(PAL.meadowDeep, PAL.nightShade, 0.45), 1);
          g.fillRect(0, H * 0.6, W, H * 0.4);
          // moonlit stream
          g.fillStyle(PAL.waterShallow, 0.85);
          g.beginPath();
          g.moveTo(W * 0.52, H * 0.6);
          for (let i = 0; i <= 20; i++) {
            const t = i / 20;
            g.lineTo(W * (0.52 + Math.sin(t * 4) * 0.06) + t * 60 - 30 + 40, H * (0.6 + t * 0.4));
          }
          for (let i = 20; i >= 0; i--) {
            const t = i / 20;
            g.lineTo(W * (0.52 + Math.sin(t * 4) * 0.06) + t * 60 - 30 - 40 - t * 80, H * (0.6 + t * 0.4));
          }
          g.closePath();
          g.fillPath();
          g.fillStyle(0xf2d8a0, 0.8);
          g.fillCircle(W * 0.2, H * 0.18, 38);
        }
      }
    ];

    let idx = 0;
    const paint = this.add.graphics();
    const textBg = this.add.graphics();
    const text = this.add.text(W / 2, H * 0.86, '', {
      fontFamily: SERIF,
      fontSize: '23px',
      color: '#fff8ea',
      align: 'center',
      lineSpacing: 8
    }).setOrigin(0.5);
    const tap = this.add.text(W - 30, H - 24, 'tap ▸', {
      fontFamily: SERIF,
      fontSize: '16px',
      color: '#fff8ea'
    }).setOrigin(1).setAlpha(0.6);
    this.tweens.add({ targets: tap, alpha: 0.25, duration: 800, yoyo: true, repeat: -1 });

    const show = () => {
      if (idx >= panels.length) {
        this.cameras.main.fadeOut(800, 10, 16, 26);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Game'));
        return;
      }
      const p = panels[idx];
      paint.clear();
      p.paint(paint, this);
      textBg.clear();
      textBg.fillStyle(0x14202e, 0.55);
      textBg.fillRoundedRect(W * 0.5 - 470, H * 0.86 - 70, 940, 140, 18);
      text.setText(p.text);
      this.cameras.main.fadeIn(500, 10, 16, 26);
      idx++;
    };
    show();
    this.input.on('pointerdown', show);
    this.input.keyboard?.on('keydown', show);
  }
}
