import Phaser from 'phaser';
import { PAL } from '../palette';
import { FIELD_NOTES } from '../facts';
import { journalNotes } from '../save';

const W = 1280;
const H = 720;
const SERIF = 'Georgia, "Times New Roman", serif';

/**
 * The Field Journal: every note the player has earned by doing, archived.
 * The encyclopedia you collect, never the homework you're assigned.
 */
export class JournalScene extends Phaser.Scene {
  constructor() {
    super('Journal');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x223240);

    const unlocked = journalNotes().filter((id) => FIELD_NOTES[id]);
    const total = Object.keys(FIELD_NOTES).length;

    const frame = this.add.graphics();
    frame.fillStyle(PAL.uiCard, 0.96);
    frame.fillRoundedRect(W / 2 - 480, 40, 960, H - 80, 24);
    frame.fillStyle(PAL.uiGood, 1);
    frame.fillRoundedRect(W / 2 - 480, 40, 960, 10, { tl: 24, tr: 24, bl: 0, br: 0 });

    this.add.text(W / 2, 84, 'Field Journal', {
      fontFamily: SERIF, fontSize: '38px', color: '#3a3328', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(W / 2, 126, `${unlocked.length} of ${total} notes earned — they unlock as Dan lives them`, {
      fontFamily: SERIF, fontSize: '16px', color: '#7a6f5c'
    }).setOrigin(0.5);

    // scrollable list of earned notes
    const listTop = 156;
    const listBottom = H - 110;
    const content = this.add.container(0, 0);
    let y = listTop;
    if (unlocked.length === 0) {
      this.add.text(W / 2, (listTop + listBottom) / 2, 'No notes yet.\nGo live a little — swim, gnaw, build.', {
        fontFamily: SERIF, fontSize: '20px', color: '#9c8e74', align: 'center', lineSpacing: 8
      }).setOrigin(0.5);
    }
    for (const id of unlocked) {
      const note = FIELD_NOTES[id];
      const body = this.add.text(W / 2 - 416, y + 34, note.body, {
        fontFamily: SERIF, fontSize: '15px', color: '#5c5343', wordWrap: { width: 830 }, lineSpacing: 3
      });
      const title = this.add.text(W / 2 - 416, y + 8, note.title, {
        fontFamily: SERIF, fontSize: '21px', color: '#3a3328', fontStyle: 'bold'
      });
      const rule = this.add.graphics();
      rule.lineStyle(1.5, 0xded3bd, 1);
      rule.lineBetween(W / 2 - 416, y, W / 2 + 416, y);
      content.add([rule, title, body]);
      y += 50 + body.height;
    }
    const contentHeight = y - listTop;
    const maxScroll = Math.max(0, contentHeight - (listBottom - listTop));

    const mask = this.make.graphics({}, false);
    mask.fillRect(W / 2 - 460, listTop, 920, listBottom - listTop);
    content.setMask(mask.createGeometryMask());

    // wheel + drag scrolling
    let scroll = 0;
    const applyScroll = () => {
      scroll = Math.max(0, Math.min(maxScroll, scroll));
      content.y = -scroll;
    };
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      scroll += dy * 0.6;
      applyScroll();
    });
    let dragging = false;
    let dragStartY = 0;
    let dragStartScroll = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y > listTop && p.y < listBottom) {
        dragging = true;
        dragStartY = p.y;
        dragStartScroll = scroll;
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (dragging) {
        scroll = dragStartScroll - (p.y - dragStartY);
        applyScroll();
      }
    });
    this.input.on('pointerup', () => (dragging = false));

    const back = this.add.text(W / 2, H - 72, '◂ back', {
      fontFamily: SERIF, fontSize: '22px', color: '#7a6f5c', fontStyle: 'bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('Title'));
  }
}
