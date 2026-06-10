import type { TreeState } from './world';

/**
 * Save/continue support. One slot, autosaved at meaningful beats
 * (objective changes, builds, dawn, sleep) plus a rolling timer, so a
 * phone call mid-pond never costs the player their valley.
 *
 * The Field Journal (unlocked notes) persists separately and survives
 * finishing a chapter or starting a new game.
 */
export interface SaveData {
  v: 1;
  objectiveIdx: number;
  objectiveCount: number;
  damLogs: number;
  lodgeLogs: number;
  damStage: number;
  energy: number;
  day: number;
  timeOfDay: number;
  dan: { tx: number; ty: number; carrying: boolean };
  trees: Array<{ id: number; state: TreeState }>;
  logs: Array<{ tx: number; ty: number }>;
  canals: Array<{ tx: number; ty: number }>;
  notes: string[];
}

const SAVE_KEY = 'bd-save';
const JOURNAL_KEY = 'bd-journal';

export function saveGame(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    /* private mode / quota — play on without persistence */
  }
}

export function loadGame(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    return data.v === 1 ? data : null;
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  return loadGame() !== null;
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

export function journalNotes(): string[] {
  try {
    return JSON.parse(localStorage.getItem(JOURNAL_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

export function addJournalNote(id: string): void {
  try {
    const notes = journalNotes();
    if (!notes.includes(id)) {
      notes.push(id);
      localStorage.setItem(JOURNAL_KEY, JSON.stringify(notes));
    }
  } catch {
    /* ignore */
  }
}
