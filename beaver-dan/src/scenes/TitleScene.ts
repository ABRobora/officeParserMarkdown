import Phaser from 'phaser';
import { PAL, mix } from '../palette';

const W = 1280;
const H = 720;
const SERIF = 'Georgia, "Times New Roman", serif';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    const g = this.add.graphics();

    // dusk sky in soft bands
    const bands = 24;
    for (let i = 0; i < bands; i++) {
      g.fillStyle(mix(PAL.skyTop, PAL.duskBottom, i / (bands - 1)), 1);
      g.fillRect(0, (H * 0.62 * i) / bands, W, H * 0.62 / bands + 1);
    }
    g.fillStyle(0xfff2cc, 0.9);
    g.fillCircle(W * 0.68, H * 0.3, 52);
    g.fillStyle(0xfff2cc, 0.18);
    g.fillCircle(W * 0.68, H * 0.3, 78);

    // layered hills
    g.fillStyle(PAL.hillFar, 1);
    g.fillEllipse(W * 0.2, H * 0.66, W, H * 0.32);
    g.fillStyle(PAL.hillMid, 1);
    g.fillEllipse(W * 0.85, H * 0.7, W * 1.1, H * 0.34);
    g.fillStyle(PAL.hillNear, 1);
    g.fillEllipse(W * 0.4, H * 0.78, W * 1.3, H * 0.36);

    // water
    g.fillStyle(PAL.waterDeep, 1);
    g.fillRect(0, H * 0.72, W, H * 0.28);
    g.fillStyle(PAL.waterShallow, 0.35);
    for (let i = 0; i < 7; i++) {
      g.fillEllipse(W * (0.15 + i * 0.13), H * (0.76 + (i % 3) * 0.05), 140, 7);
    }
    // sun glint road
    g.fillStyle(0xfff2cc, 0.25);
    g.fillEllipse(W * 0.68, H * 0.8, 90, 60);

    // pines on the near hill
    g.fillStyle(mix(PAL.pineDark, PAL.nightShade, 0.3), 1);
    for (const [px, py, s] of [[0.06, 0.6, 1.1], [0.13, 0.62, 0.8], [0.9, 0.58, 1.2], [0.97, 0.62, 0.8]] as const) {
      g.fillTriangle(W * px - 30 * s, H * py, W * px + 30 * s, H * py, W * px, H * py - 150 * s);
    }

    // Dan, swimming through the title
    const dan = this.add.image(W * 0.34, H * 0.79, 'beaver-swim').setScale(2.2);
    this.tweens.add({ targets: dan, x: W * 0.4, y: H * 0.785, duration: 4200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const title = this.add.text(W / 2, H * 0.22, 'BEAVER DAN', {
      fontFamily: SERIF,
      fontSize: '92px',
      color: '#fff8ea',
      fontStyle: 'bold'
    }).setOrigin(0.5).setShadow(0, 6, 'rgba(30,20,10,0.45)', 12);
    this.add.text(W / 2, H * 0.34, 'a river of your own', {
      fontFamily: SERIF,
      fontSize: '26px',
      color: '#fff8ea',
      fontStyle: 'italic'
    }).setOrigin(0.5).setAlpha(0.9);
    this.tweens.add({ targets: title, y: H * 0.215, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.makeButton(W / 2, H * 0.56, 'BEGIN', () => this.scene.start('Story'));
    this.makeButton(W / 2, H * 0.56 + 86, 'HELP REAL BEAVERS', () => this.scene.start('Donate'), true);

    this.add.text(W / 2, H - 18,
      'free forever · donations go to beaver & wetland charities · sounds and final art in progress',
      { fontFamily: SERIF, fontSize: '14px', color: '#fff8ea' }
    ).setOrigin(0.5).setAlpha(0.55);
  }

  private makeButton(x: number, y: number, label: string, onClick: () => void, secondary = false): void {
    const w = 360;
    const h = 64;
    const bg = this.add.graphics();
    const draw = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(secondary ? PAL.uiGood : PAL.uiAccent, hover ? 1 : 0.92);
      bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 18);
      bg.lineStyle(3, 0xfff8ea, hover ? 0.9 : 0.5);
      bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 18);
    };
    draw(false);
    this.add.text(x, y, label, {
      fontFamily: SERIF,
      fontSize: '26px',
      color: '#fff8ea',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    const zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerdown', onClick);
  }
}
