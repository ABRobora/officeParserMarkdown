/**
 * Chapter / objective chain for the playable prototype.
 * The prototype covers the heart of a beaver's story — dispersal and the
 * founding of a new pond. (Kit-hood, family and winter chapters are in
 * docs/GAME_DESIGN.md and arrive in later milestones.)
 */
export interface Objective {
  id: string;
  /** Short imperative shown on the HUD card. */
  text: string;
  /** Optional flavour line under the objective. */
  hint?: string;
  /** Progress target (e.g. logs to deliver). 0 = boolean objective. */
  target: number;
}

export const OBJECTIVES: Objective[] = [
  {
    id: 'explore',
    text: 'Find the narrow bend in the stream',
    hint: 'Swim downstream — fast water between boulders marks a dam site.',
    target: 0
  },
  {
    id: 'fellTrees',
    text: 'Fell 3 aspens near the bank',
    hint: 'Hold GNAW beside a pale-barked aspen. Aspen is food and lumber.',
    target: 3
  },
  {
    id: 'buildDam',
    text: 'Build the dam — float 8 logs to the narrows',
    hint: 'Carry logs to the marked narrows. Watch the valley change.',
    target: 8
  },
  {
    id: 'buildLodge',
    text: 'Raise a lodge in your new pond',
    hint: 'Bring 4 logs to the lodge site in deep water.',
    target: 4
  },
  {
    id: 'prepareWinter',
    text: 'Eat well, then sleep in your lodge',
    hint: 'Fill your energy, then enter the lodge as dusk falls.',
    target: 0
  }
];

export function objectiveIndex(id: string): number {
  return OBJECTIVES.findIndex((o) => o.id === id);
}
