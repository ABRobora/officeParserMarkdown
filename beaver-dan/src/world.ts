import { noise2 } from './iso';

export type TreeKind = 'aspen' | 'willow' | 'pine';
export type TreeState = 'standing' | 'stump' | 'snag';

export interface Tree {
  id: number;
  tx: number;
  ty: number;
  kind: TreeKind;
  state: TreeState;
}

export interface Site {
  tx: number;
  ty: number;
}

/**
 * The valley: a stream winds north → south through a meadow basin.
 * Elevation rises away from the channel, so when Dan raises the dam the
 * pond floods outward upstream of it — exactly how a real beaver pond grows.
 */
export class World {
  readonly W = 44;
  readonly H = 44;

  /** Stream row where the valley narrows — the dam site. */
  readonly damTy = 30;
  readonly baseWater = 0.45;
  /** Rises 0 → 4 as logs are woven into the dam. */
  damStage = 0;
  /** What the renderer shows — tweened toward damStage during flood cinematics. */
  visualStage = 0;
  /** Tiles the player has dug out to float wood through. */
  readonly canals: Site[] = [];

  readonly damSite: Site;
  readonly lodgeSite: Site;
  /** Dan arrives here, swimming downstream at the end of dispersal. */
  readonly spawn: Site;

  readonly trees: Tree[] = [];
  private elevMap: number[] = [];

  constructor() {
    for (let ty = 0; ty < this.H; ty++) {
      for (let tx = 0; tx < this.W; tx++) {
        this.elevMap[ty * this.W + tx] = this.computeElevation(tx, ty);
      }
    }
    this.damSite = { tx: Math.round(this.centerX(this.damTy)), ty: this.damTy };
    this.lodgeSite = { tx: Math.round(this.centerX(this.damTy - 9)) + 2, ty: this.damTy - 9 };
    this.spawn = { tx: Math.round(this.centerX(4)), ty: 4 };
    this.plantTrees();
  }

  /** Centre of the stream channel for a given row. */
  centerX(ty: number): number {
    return this.W / 2 + Math.sin(ty * 0.22) * 5 + Math.sin(ty * 0.07 + 2) * 3;
  }

  /** Channel half-width; the valley pinches at the dam row. */
  channelHalfWidth(ty: number): number {
    const pinch = Math.max(0, 1 - Math.abs(ty - this.damTy) / 3);
    return 1.7 - pinch * 0.8;
  }

  private computeElevation(tx: number, ty: number): number {
    const d = Math.abs(tx - this.centerX(ty)) - this.channelHalfWidth(ty);
    const slope = Math.max(0, d) * 0.5;
    const n = noise2(tx, ty) * 0.25;
    return slope + n;
  }

  elevation(tx: number, ty: number): number {
    const ix = Math.max(0, Math.min(this.W - 1, Math.round(tx)));
    const iy = Math.max(0, Math.min(this.H - 1, Math.round(ty)));
    return this.elevMap[iy * this.W + ix];
  }

  /** Water surface height at a row — higher upstream of the dam as it grows. */
  waterLevelAt(ty: number): number {
    return ty <= this.damTy ? this.baseWater + this.damStage * 0.45 : this.baseWater;
  }

  /** Same, but at the tweened visual stage (used only for drawing). */
  waterLevelVisualAt(ty: number): number {
    return ty <= this.damTy ? this.baseWater + this.visualStage * 0.45 : this.baseWater;
  }

  isWater(tx: number, ty: number): boolean {
    return this.elevation(tx, ty) < this.waterLevelAt(Math.round(ty));
  }

  /** Deep enough to dive — safe from anything with paws. */
  isDeepWater(tx: number, ty: number): boolean {
    return this.elevation(tx, ty) < this.waterLevelAt(Math.round(ty)) - 0.4;
  }

  inBounds(tx: number, ty: number): boolean {
    return tx >= 1 && ty >= 1 && tx <= this.W - 2 && ty <= this.H - 2;
  }

  private plantTrees(): void {
    let id = 0;
    for (let ty = 2; ty < this.H - 2; ty++) {
      for (let tx = 2; tx < this.W - 2; tx++) {
        const e = this.elevation(tx, ty);
        if (e < this.baseWater + 0.15) continue; // too wet
        if (Math.abs(ty - this.damTy) < 3 && Math.abs(tx - this.damSite.tx) < 4) continue;
        if (Math.abs(ty - this.lodgeSite.ty) < 2 && Math.abs(tx - this.lodgeSite.tx) < 2) continue;
        const r = noise2(tx * 3 + 11, ty * 3 + 5, 13);
        if (r > 0.085) continue;
        let kind: TreeKind;
        if (e < 1.4) kind = noise2(tx, ty, 21) < 0.6 ? 'aspen' : 'willow';
        else kind = noise2(tx, ty, 21) < 0.35 ? 'aspen' : 'pine';
        this.trees.push({ id: id++, tx, ty, kind, state: 'standing' });
      }
    }
  }

  /**
   * Raise the dam one stage. Standing trees swallowed by the new shoreline
   * become snags — drowned wood that real wetlands turn into habitat.
   * Returns the trees that just drowned.
   */
  raiseDam(): Tree[] {
    this.damStage = Math.min(4, this.damStage + 1);
    const drowned: Tree[] = [];
    for (const t of this.trees) {
      if (t.state === 'standing' && this.isWater(t.tx, t.ty)) {
        t.state = 'snag';
        drowned.push(t);
      }
    }
    return drowned;
  }

  /** An unrepaired leak tears wider overnight: the pond drops a stage. */
  lowerDam(): void {
    this.damStage = Math.max(0, this.damStage - 1);
    this.visualStage = this.damStage;
  }

  /**
   * Dig a canal tile: beavers excavate channels so wood can be floated
   * instead of dragged. The tile's ground drops below the local waterline.
   */
  digCanal(tx: number, ty: number): void {
    const ix = Math.max(0, Math.min(this.W - 1, Math.round(tx)));
    const iy = Math.max(0, Math.min(this.H - 1, Math.round(ty)));
    this.elevMap[iy * this.W + ix] = this.baseWater - 0.25;
    this.canals.push({ tx: ix, ty: iy });
  }

  /** True if the rounded tile touches water on any side — diggable ground. */
  bordersWater(tx: number, ty: number): boolean {
    const ix = Math.round(tx);
    const iy = Math.round(ty);
    return (
      this.isWater(ix + 1, iy) || this.isWater(ix - 1, iy) || this.isWater(ix, iy + 1) || this.isWater(ix, iy - 1)
    );
  }
}
