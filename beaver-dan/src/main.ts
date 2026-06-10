import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { StoryScene } from './scenes/StoryScene';
import { GameScene } from './scenes/GameScene';
import { LodgeScene } from './scenes/LodgeScene';
import { UIScene } from './scenes/UIScene';
import { DonateScene } from './scenes/DonateScene';
import { JournalScene } from './scenes/JournalScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1d2b3a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720
  },
  input: {
    activePointers: 3 // joystick + action button simultaneously
  },
  scene: [BootScene, TitleScene, StoryScene, GameScene, LodgeScene, UIScene, DonateScene, JournalScene]
});

// handle for debugging and the headless smoke test
(window as unknown as { beaverDan: Phaser.Game }).beaverDan = game;
