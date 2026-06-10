/**
 * Beaver Dan — painterly palette.
 * Direction: "Old Man's Journey meets Lumino City" — soft layered hues,
 * dusk gradients, warm ochres against deep pine teals.
 */
export const PAL = {
  // sky / mood
  skyTop: 0xf4d9a8,
  skyBottom: 0xe8a87c,
  duskTop: 0x4a4e8f,
  duskBottom: 0xc96f5e,
  nightShade: 0x101c33,

  // land
  meadow: 0x9ebd6e,
  meadowDeep: 0x7da45c,
  bank: 0xc9b27c,
  forestFloor: 0x6b8f53,
  hillFar: 0x8a9bb0,
  hillMid: 0x6f8aa0,
  hillNear: 0x55748c,

  // water
  waterShallow: 0x7fb6c9,
  waterDeep: 0x4a8aa8,
  waterNight: 0x2d4a66,
  ice: 0xcfe3ec,
  ripple: 0xeaf6fa,

  // flora
  aspenTrunk: 0xe8e2d4,
  aspenLeaf: 0xc9d96e,
  aspenLeafFall: 0xe8b84a,
  willowLeaf: 0xa8c97e,
  pineDark: 0x2e5f54,
  pineLight: 0x3e7a68,
  snagGray: 0x9a958c,
  reed: 0x8fae5a,
  lily: 0x6fae7e,
  lilyBloom: 0xf2e8c9,

  // creatures
  beaverFur: 0x7a4f2e,
  beaverFurLight: 0x9a6b42,
  beaverTail: 0x4a3526,
  beaverTooth: 0xf2a93b,
  wolfFur: 0x6e7480,
  wolfFurLight: 0x9aa0ac,

  // structures
  logWood: 0xa07848,
  logCut: 0xe0c890,
  damWood: 0x8a6438,
  lodgeWood: 0x755636,
  mud: 0x6e5a42,

  // ui
  uiCard: 0xfff8ea,
  uiInk: 0x3a3328,
  uiAccent: 0xd9803e,
  uiSoft: 0x9c8e74,
  uiGood: 0x6fae7e,
  uiBad: 0xc96f5e
} as const;

/** Linear blend between two 0xRRGGBB colours. */
export function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

/** Small deterministic jitter so hand-placed things never look stamped. */
export function jitter(color: number, seed: number, amount = 0.08): number {
  const t = (Math.sin(seed * 127.1) * 43758.5453) % 1;
  const d = (Math.abs(t) - 0.5) * 2 * amount;
  return mix(color, d > 0 ? 0xffffff : 0x000000, Math.abs(d));
}
