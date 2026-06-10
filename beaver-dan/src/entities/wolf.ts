import Phaser from 'phaser';
import { World } from '../world';
import { isoToScreen, isoDepth } from '../iso';
import { Beaver } from './beaver';

/**
 * A wolf hunts the valley at night. It will wade — shallow water is NOT
 * safe — but it will not swim into deep water. Only the deep water a dam
 * creates is true sanctuary, and a submerged beaver is an invisible one.
 */
export class Wolf {
  tx: number;
  ty: number;
  active = false;

  static readonly SPEED = 2.5; // faster than Dan walks, slower than he swims
  static readonly SENSE = 11; // tiles
  static readonly LUNGE = 1.5; // reach into shallow water

  readonly container: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Image;
  private lope = 0;
  private wanderAngle = Math.random() * Math.PI * 2;
  private wanderTimer = 0;
  private fleeTimer = 0;

  constructor(scene: Phaser.Scene, private world: World) {
    this.tx = 6;
    this.ty = 6;
    const shadow = scene.add.image(0, 8, 'shadow').setScale(1.2, 1);
    this.body = scene.add.image(0, -12, 'wolf');
    this.container = scene.add.container(0, 0, [shadow, this.body]);
    this.container.setVisible(false);
  }

  /** Slip out of the treeline at dusk, far from Dan. */
  spawnFor(dan: Beaver): void {
    for (let i = 0; i < 40; i++) {
      const tx = 3 + Math.random() * (this.world.W - 6);
      const ty = 3 + Math.random() * (this.world.H - 6);
      if (!this.world.isWater(tx, ty) && Math.hypot(tx - dan.tx, ty - dan.ty) > 16) {
        this.tx = tx;
        this.ty = ty;
        this.active = true;
        this.fleeTimer = 0;
        this.container.setVisible(true);
        return;
      }
    }
  }

  despawn(): void {
    this.active = false;
    this.container.setVisible(false);
  }

  /** A nearby tail-slap sends the wolf loping for the treeline. */
  scare(): void {
    this.fleeTimer = 9;
  }

  /** @returns 'caught' when the wolf reaches Dan on land or lunges into the shallows. */
  update(dt: number, dan: Beaver): 'caught' | 'hunting' | 'idle' {
    if (!this.active) return 'idle';

    const danInDeep = this.world.isDeepWater(dan.tx, dan.ty);
    const danInWater = this.world.isWater(dan.tx, dan.ty);
    const danVisible = !dan.submerged && !danInDeep;
    const d = Math.hypot(dan.tx - this.tx, dan.ty - this.ty);
    let result: 'caught' | 'hunting' | 'idle' = 'idle';

    let dirX: number;
    let dirY: number;
    let speed: number;

    if (this.fleeTimer > 0) {
      this.fleeTimer -= dt;
      dirX = (this.tx - dan.tx) / (d || 1);
      dirY = (this.ty - dan.ty) / (d || 1);
      speed = Wolf.SPEED * 1.1;
      if (this.fleeTimer <= 0 || this.tx < 3 || this.ty < 3 || this.tx > this.world.W - 3 || this.ty > this.world.H - 3) {
        this.despawn();
        return 'idle';
      }
    } else if (danVisible && d < Wolf.SENSE) {
      dirX = (dan.tx - this.tx) / (d || 1);
      dirY = (dan.ty - this.ty) / (d || 1);
      speed = Wolf.SPEED;
      result = 'hunting';
      // on land it must close fully; into the shallows it can lunge
      const catchRange = danInWater ? Wolf.LUNGE : 0.8;
      if (d < catchRange) result = 'caught';
    } else {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderAngle = Math.random() * Math.PI * 2;
        this.wanderTimer = 2 + Math.random() * 3;
      }
      dirX = Math.cos(this.wanderAngle) * 0.35;
      dirY = Math.sin(this.wanderAngle) * 0.35;
      speed = Wolf.SPEED * 0.4;
    }

    const nx = this.tx + dirX * speed * dt;
    const ny = this.ty + dirY * speed * dt;
    // wolves wade the margins but never swim the deep
    if (this.world.inBounds(nx, this.ty) && !this.world.isDeepWater(nx, this.ty)) this.tx = nx;
    else this.wanderTimer = 0;
    if (this.world.inBounds(this.tx, ny) && !this.world.isDeepWater(this.tx, ny)) this.ty = ny;
    else this.wanderTimer = 0;

    this.lope += dt * 9;
    this.body.y = -12 + Math.sin(this.lope) * 1.4;
    this.body.setFlipX(dirX < 0);

    const p = isoToScreen(this.tx, this.ty);
    this.container.setPosition(p.x, p.y);
    this.container.setDepth(isoDepth(this.tx, this.ty) + 5);
    return result;
  }
}
