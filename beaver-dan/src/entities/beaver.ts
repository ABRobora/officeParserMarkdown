import Phaser from 'phaser';
import { World } from '../world';
import { isoToScreen, isoDepth, TILE_W, TILE_H } from '../iso';

export type BeaverMode = 'walk' | 'swim';

/**
 * Beaver Dan. Position lives in fractional tile coordinates; the container
 * is re-projected to screen space every frame. The land/water speed split
 * is the core survival lesson: slow and vulnerable ashore, fast and safe afloat.
 */
export class Beaver {
  tx: number;
  ty: number;
  mode: BeaverMode = 'swim';
  carrying = false;
  /** Underwater: hidden from predators, on a breath timer (GameScene owns it). */
  submerged = false;
  facing = 1;

  /** tiles per second */
  static readonly LAND_SPEED = 2.1;
  static readonly WATER_SPEED = 4.0;

  readonly container: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private carryLog: Phaser.GameObjects.Image;
  private waddle = 0;

  constructor(scene: Phaser.Scene, private world: World) {
    this.tx = world.spawn.tx;
    this.ty = world.spawn.ty;

    this.shadow = scene.add.image(0, 10, 'shadow');
    this.body = scene.add.image(0, -10, 'beaver-swim');
    this.carryLog = scene.add.image(8, -22, 'log').setVisible(false);
    this.container = scene.add.container(0, 0, [this.shadow, this.body, this.carryLog]);
    this.reproject();
  }

  setCarrying(on: boolean): void {
    this.carrying = on;
    this.refreshCarryLog();
  }

  setSubmerged(on: boolean): void {
    this.submerged = on;
    this.body.setAlpha(on ? 0.45 : 1);
    this.body.setTint(on ? 0x9ec8d8 : 0xffffff);
    this.refreshCarryLog();
  }

  private refreshCarryLog(): void {
    // logs are carried ashore and towed afloat, but never taken under
    this.carryLog.setVisible(this.carrying && !this.submerged);
    this.carryLog.y = this.mode === 'walk' ? -22 : -6;
  }

  /** Move by an input vector given in screen space (joystick / keys). */
  update(dt: number, inputX: number, inputY: number): void {
    // screen direction → isometric tile direction
    let dtx = inputX / TILE_W + inputY / TILE_H;
    let dty = inputY / TILE_H - inputX / TILE_W;
    const len = Math.hypot(dtx, dty);
    const moving = len > 0.01;
    if (moving) {
      dtx /= len;
      dty /= len;
      const speed = (this.mode === 'swim' ? Beaver.WATER_SPEED : Beaver.LAND_SPEED) * (this.submerged ? 0.75 : 1);
      const nx = this.tx + dtx * speed * dt;
      const ny = this.ty + dty * speed * dt;
      if (this.world.inBounds(nx, this.ty)) this.tx = nx;
      if (this.world.inBounds(this.tx, ny)) this.ty = ny;
      if (Math.abs(inputX) > 2) this.facing = inputX > 0 ? 1 : -1;
    }

    const inWater = this.world.isWater(this.tx, this.ty);
    const newMode: BeaverMode = inWater ? 'swim' : 'walk';
    if (newMode !== this.mode) {
      this.mode = newMode;
      this.body.setTexture(newMode === 'swim' ? 'beaver-swim' : 'beaver');
      this.shadow.setVisible(newMode === 'walk');
      if (newMode === 'walk' && this.submerged) this.setSubmerged(false);
      this.refreshCarryLog();
    }

    // waddle / paddle bob — cheap, characterful
    if (moving) {
      this.waddle += dt * (this.mode === 'walk' ? 11 : 6);
      this.body.y = -10 + Math.sin(this.waddle) * (this.mode === 'walk' ? 1.6 : 1.0);
      this.body.angle = Math.sin(this.waddle * 0.5) * (this.mode === 'walk' ? 3 : 1.5);
    } else {
      this.body.angle *= 0.8;
    }
    this.body.setFlipX(this.facing < 0);
    this.carryLog.x = 8 * this.facing;

    this.reproject();
  }

  reproject(): void {
    const p = isoToScreen(this.tx, this.ty);
    this.container.setPosition(p.x, p.y);
    this.container.setDepth(isoDepth(this.tx, this.ty) + 5);
  }

  distTo(tx: number, ty: number): number {
    return Math.hypot(this.tx - tx, this.ty - ty);
  }
}
