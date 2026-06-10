import Phaser from 'phaser';
import { PAL, mix } from './palette';

/**
 * Every visual in the prototype is generated at boot from layered, soft
 * shapes — a deliberately handcrafted, storybook look (and zero binary
 * assets in the repo). Final production art replaces these one texture
 * at a time without touching game code.
 */
export function generateTextures(scene: Phaser.Scene): void {
  const make = (key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
    if (scene.textures.exists(key)) return;
    const g = scene.add.graphics();
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };

  // ---- soft drop shadow used under every creature/prop ----
  make('shadow', 48, 20, (g) => {
    g.fillStyle(0x14202e, 0.28);
    g.fillEllipse(24, 10, 44, 16);
  });

  // ---- Beaver Dan, walking (side profile, flipX for direction) ----
  make('beaver', 52, 40, (g) => {
    // tail
    g.fillStyle(PAL.beaverTail, 1);
    g.fillEllipse(10, 30, 20, 9);
    // body
    g.fillStyle(PAL.beaverFur, 1);
    g.fillEllipse(28, 25, 30, 20);
    // back highlight
    g.fillStyle(PAL.beaverFurLight, 1);
    g.fillEllipse(28, 20, 24, 10);
    // head
    g.fillStyle(PAL.beaverFur, 1);
    g.fillCircle(43, 19, 9);
    // ear
    g.fillStyle(PAL.beaverTail, 1);
    g.fillCircle(41, 12, 2.5);
    // muzzle + teeth
    g.fillStyle(PAL.beaverFurLight, 1);
    g.fillEllipse(48, 22, 8, 6);
    g.fillStyle(PAL.beaverTooth, 1);
    g.fillRect(48, 24, 3, 4);
    // eye
    g.fillStyle(0x2a2118, 1);
    g.fillCircle(44, 17, 1.6);
    // feet
    g.fillStyle(PAL.beaverTail, 1);
    g.fillEllipse(22, 35, 8, 5);
    g.fillEllipse(34, 35, 8, 5);
  });

  // ---- Dan swimming: head, wet back, V-wake ----
  make('beaver-swim', 56, 28, (g) => {
    g.fillStyle(PAL.ripple, 0.45);
    g.fillTriangle(2, 6, 2, 22, 34, 14);
    g.fillStyle(PAL.beaverFur, 1);
    g.fillEllipse(30, 16, 26, 10);
    g.fillCircle(44, 13, 8);
    g.fillStyle(PAL.beaverFurLight, 1);
    g.fillEllipse(47, 16, 7, 5);
    g.fillStyle(0x2a2118, 1);
    g.fillCircle(46, 11, 1.6);
  });

  // ---- carried log (drawn over Dan's head while hauling) ----
  make('log', 36, 14, (g) => {
    g.fillStyle(PAL.logWood, 1);
    g.fillRoundedRect(0, 2, 36, 10, 5);
    g.fillStyle(PAL.logCut, 1);
    g.fillEllipse(34, 7, 5, 9);
    g.fillStyle(mix(PAL.logWood, 0x000000, 0.18), 1);
    g.fillRect(6, 4, 22, 1.5);
    g.fillRect(9, 9, 18, 1.5);
  });

  // ---- trees ----
  make('tree-aspen', 56, 84, (g) => {
    g.fillStyle(PAL.aspenTrunk, 1);
    g.fillRect(25, 38, 6, 44);
    g.fillStyle(0x8a8576, 1);
    g.fillRect(26, 48, 4, 2);
    g.fillRect(26, 62, 4, 2);
    g.fillStyle(mix(PAL.aspenLeaf, 0x000000, 0.12), 1);
    g.fillCircle(20, 30, 15);
    g.fillCircle(38, 34, 13);
    g.fillStyle(PAL.aspenLeaf, 1);
    g.fillCircle(28, 20, 16);
    g.fillStyle(mix(PAL.aspenLeaf, 0xffffff, 0.18), 1);
    g.fillCircle(33, 14, 9);
  });

  make('tree-willow', 60, 70, (g) => {
    g.fillStyle(mix(PAL.logWood, 0x000000, 0.1), 1);
    g.fillRect(27, 34, 6, 36);
    g.fillStyle(mix(PAL.willowLeaf, 0x000000, 0.12), 1);
    g.fillEllipse(30, 30, 52, 36);
    g.fillStyle(PAL.willowLeaf, 1);
    g.fillEllipse(28, 24, 42, 28);
    g.fillStyle(mix(PAL.willowLeaf, 0xffffff, 0.15), 1);
    g.fillEllipse(34, 18, 22, 14);
  });

  make('tree-pine', 52, 92, (g) => {
    g.fillStyle(0x4a3a2a, 1);
    g.fillRect(24, 70, 5, 22);
    g.fillStyle(PAL.pineDark, 1);
    g.fillTriangle(26, 2, 6, 50, 46, 50);
    g.fillStyle(PAL.pineLight, 1);
    g.fillTriangle(26, 22, 10, 62, 42, 62);
    g.fillStyle(PAL.pineDark, 1);
    g.fillTriangle(26, 40, 8, 76, 44, 76);
  });

  make('stump', 28, 22, (g) => {
    g.fillStyle(mix(PAL.logWood, 0x000000, 0.15), 1);
    g.fillRect(8, 8, 12, 10);
    g.fillStyle(PAL.logCut, 1);
    g.fillEllipse(14, 8, 14, 8);
    g.fillStyle(mix(PAL.logCut, 0x000000, 0.15), 1);
    g.fillEllipse(14, 8, 8, 4);
  });

  // drowned standing snag (post-flood habitat tree)
  make('snag', 30, 70, (g) => {
    g.fillStyle(PAL.snagGray, 1);
    g.fillRect(13, 10, 5, 60);
    g.fillRect(8, 22, 12, 3);
    g.fillRect(14, 34, 14, 3);
    g.fillStyle(mix(PAL.snagGray, 0x000000, 0.2), 1);
    g.fillEllipse(15, 26, 4, 5); // woodpecker cavity
  });

  // ---- wolf ----
  make('wolf', 64, 42, (g) => {
    g.fillStyle(PAL.wolfFur, 1);
    g.fillEllipse(30, 24, 38, 16);
    g.fillCircle(50, 17, 8);
    g.fillTriangle(54, 14, 64, 18, 54, 22); // muzzle
    g.fillTriangle(45, 12, 48, 2, 51, 12); // ear
    g.fillStyle(PAL.wolfFurLight, 1);
    g.fillEllipse(30, 19, 30, 8);
    g.fillStyle(PAL.wolfFur, 1);
    g.fillRect(18, 28, 5, 13);
    g.fillRect(40, 28, 5, 13);
    g.fillStyle(mix(PAL.wolfFur, 0x000000, 0.2), 1);
    g.fillEllipse(10, 20, 16, 7); // tail
    g.fillStyle(0xf2d24a, 1);
    g.fillCircle(51, 15, 1.8); // eye
  });

  // ---- lodge: stick-dome island fortress ----
  make('lodge', 110, 70, (g) => {
    g.fillStyle(PAL.mud, 1);
    g.fillEllipse(55, 52, 104, 32);
    g.fillStyle(PAL.lodgeWood, 1);
    g.fillEllipse(55, 36, 88, 52);
    g.lineStyle(3, mix(PAL.lodgeWood, 0x000000, 0.25), 1);
    for (let i = 0; i < 12; i++) {
      const a = -0.2 - i * 0.24;
      g.lineBetween(55 + Math.cos(a) * 12, 36 + Math.sin(a) * 8, 55 + Math.cos(a) * 46, 36 + Math.sin(a) * 26);
    }
    g.lineStyle(3, mix(PAL.lodgeWood, 0xffffff, 0.18), 1);
    for (let i = 0; i < 8; i++) {
      const a = 0.3 + i * 0.32;
      g.lineBetween(55 - Math.cos(a) * 10, 34 - Math.sin(a) * 6, 55 - Math.cos(a) * 42, 34 + Math.sin(a) * 22);
    }
  });

  // marker shown at build sites
  make('site-marker', 40, 40, (g) => {
    g.lineStyle(3, PAL.uiAccent, 0.9);
    g.strokeCircle(20, 20, 16);
    g.fillStyle(PAL.uiAccent, 0.25);
    g.fillCircle(20, 20, 16);
  });

  make('boulder', 36, 26, (g) => {
    g.fillStyle(0x8a8a90, 1);
    g.fillEllipse(18, 16, 34, 20);
    g.fillStyle(0xa5a5ab, 1);
    g.fillEllipse(14, 11, 18, 10);
  });

  // ---- pond flora ----
  make('reeds', 26, 36, (g) => {
    g.lineStyle(2.5, PAL.reed, 1);
    g.lineBetween(6, 36, 4, 8);
    g.lineBetween(13, 36, 14, 2);
    g.lineBetween(20, 36, 23, 10);
    g.fillStyle(mix(PAL.reed, 0x000000, 0.25), 1);
    g.fillEllipse(14, 4, 4, 9);
  });

  make('lily', 26, 14, (g) => {
    g.fillStyle(PAL.lily, 1);
    g.fillEllipse(13, 8, 24, 11);
    g.fillStyle(PAL.waterShallow, 1);
    g.fillTriangle(13, 8, 26, 4, 26, 12);
    g.fillStyle(PAL.lilyBloom, 1);
    g.fillCircle(9, 5, 3.5);
  });

  // ---- particles ----
  make('ripple', 24, 24, (g) => {
    g.lineStyle(2, PAL.ripple, 0.8);
    g.strokeCircle(12, 12, 10);
  });

  make('chip', 8, 8, (g) => {
    g.fillStyle(PAL.logCut, 1);
    g.fillRect(1, 2, 6, 4);
  });

  make('leaf', 10, 10, (g) => {
    g.fillStyle(PAL.aspenLeaf, 1);
    g.fillEllipse(5, 5, 8, 5);
  });

  make('zzz', 18, 18, (g) => {
    g.lineStyle(2.5, PAL.uiCard, 0.9);
    g.lineBetween(3, 4, 13, 4);
    g.lineBetween(13, 4, 3, 14);
    g.lineBetween(3, 14, 13, 14);
  });

  // 1px white square, tinted everywhere a flat rect is needed
  make('px', 2, 2, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 2, 2);
  });
}
