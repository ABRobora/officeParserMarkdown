/**
 * Isometric helpers. The world is a diamond grid; tile (0,0) is the far
 * north corner. Screen-space follows the classic 2:1 projection.
 */
export const TILE_W = 64;
export const TILE_H = 32;

export interface Vec2 {
  x: number;
  y: number;
}

/** Tile coordinates (may be fractional for smooth movement) → screen px. */
export function isoToScreen(tx: number, ty: number): Vec2 {
  return {
    x: (tx - ty) * (TILE_W / 2),
    y: (tx + ty) * (TILE_H / 2)
  };
}

/** Screen px → tile coordinates. */
export function screenToIso(x: number, y: number): Vec2 {
  return {
    x: y / TILE_H + x / TILE_W,
    y: y / TILE_H - x / TILE_W
  };
}

/** Depth used for painter's-order sorting of world sprites. */
export function isoDepth(tx: number, ty: number): number {
  return (tx + ty) * 10;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Cheap deterministic value noise in [0,1). */
export function noise2(x: number, y: number, seed = 7): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return n - Math.floor(n);
}
