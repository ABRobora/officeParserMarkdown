import Phaser from 'phaser';
import { PAL } from '../palette';

const W = 1280;
const H = 720;
const SERIF = 'Georgia, "Times New Roman", serif';

interface Charity {
  name: string;
  region: string;
  blurb: string;
}

/**
 * Donation screen. In the released game this hooks into platform in-app
 * purchases / payment links; 90% of every donation goes to the chosen
 * charity, 10% covers our costs — stated plainly to the player.
 */
const CHARITIES: Charity[] = [
  {
    name: 'Beaver Trust',
    region: 'United Kingdom',
    blurb: 'Restoring beavers and their wetlands across Britain.'
  },
  {
    name: 'The Beaver Institute',
    region: 'North America',
    blurb: 'Beaver–human coexistence: flow devices instead of trapping.'
  },
  {
    name: 'Worth A Dam',
    region: 'California, USA',
    blurb: 'Education and urban beaver advocacy, born in Martinez, CA.'
  },
  {
    name: 'Rewilding Europe',
    region: 'Europe',
    blurb: 'Bringing back keystone species, beavers included, continent-wide.'
  }
];

export class DonateScene extends Phaser.Scene {
  constructor() {
    super('Donate');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x223240);
    const g = this.add.graphics();
    g.fillStyle(PAL.uiCard, 0.96);
    g.fillRoundedRect(W / 2 - 480, 40, 960, H - 80, 24);
    g.fillStyle(PAL.uiGood, 1);
    g.fillRoundedRect(W / 2 - 480, 40, 960, 10, { tl: 24, tr: 24, bl: 0, br: 0 });

    this.add.text(W / 2, 86, 'Help Real Beavers', {
      fontFamily: SERIF, fontSize: '40px', color: '#3a3328', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(W / 2, 134,
      'Beaver Dan is free. If it made you care about the real thing, you can donate here.\n' +
      '90% goes straight to the charity you pick; 10% keeps this game alive.',
      { fontFamily: SERIF, fontSize: '17px', color: '#7a6f5c', align: 'center', lineSpacing: 5 }
    ).setOrigin(0.5);

    let y = 200;
    for (const c of CHARITIES) {
      const card = this.add.graphics();
      card.fillStyle(0xf2ead8, 1);
      card.fillRoundedRect(W / 2 - 430, y, 860, 86, 14);
      this.add.text(W / 2 - 404, y + 14, c.name, {
        fontFamily: SERIF, fontSize: '23px', color: '#3a3328', fontStyle: 'bold'
      });
      this.add.text(W / 2 - 404, y + 48, c.blurb, {
        fontFamily: SERIF, fontSize: '15px', color: '#7a6f5c'
      });
      this.add.text(W / 2 + 404, y + 16, c.region, {
        fontFamily: SERIF, fontSize: '14px', color: '#8fae5a', fontStyle: 'bold'
      }).setOrigin(1, 0);
      const btn = this.add.text(W / 2 + 404, y + 46, 'DONATE ▸', {
        fontFamily: SERIF, fontSize: '18px', color: '#d9803e', fontStyle: 'bold'
      }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => this.comingSoon());
      y += 100;
    }

    const back = this.add.text(W / 2, H - 76, '◂ back', {
      fontFamily: SERIF, fontSize: '22px', color: '#7a6f5c', fontStyle: 'bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('Title'));
  }

  private comingSoon(): void {
    const t = this.add.text(W / 2, H - 120,
      'Donations open with the store release — payment rails are not wired up in this prototype.',
      {
        fontFamily: SERIF, fontSize: '16px', color: '#fff8ea',
        backgroundColor: 'rgba(20,32,46,0.85)', padding: { x: 16, y: 10 }
      }
    ).setOrigin(0.5);
    this.tweens.add({ targets: t, alpha: 0, delay: 2200, duration: 500, onComplete: () => t.destroy() });
  }
}
