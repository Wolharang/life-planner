// Local-first repository for TimeBlocks (data-model §2.3 · PRD R5). Same AsyncStorage Repository
// pattern as eventRepository — features talk to this interface, never storage, so the impl swaps to
// Firestore at F0 without touching any screen (architecture §7).
//
// It also owns the ONE-TIME prototype migration (data-model §8.4): the old `lp.tasks.v1` Task list is
// converted to per-date blocks the first time blocks are read, then the old key is dropped. Recurrence
// has no home in the full-app model, so a recurring task lands as a single block on today (the founder
// re-places it on the days he wants — the add screen can do several dates at once).

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BlockKind, Task, TimeBlock } from "./types";

const KEY = "lp.blocks.v1";
const LEGACY_KEY = "lp.tasks.v1";

export type { TimeBlock } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** A workout/run block IS the workout record (D22), so the migration guesses `kind` from the title the
 *  prototype only ever rendered as an icon. Wrong guesses are harmless and editable. */
export function guessKind(title: string): BlockKind {
  if (/헬스|운동|웨이트|근력|짐|gym|workout|리프트/i.test(title)) return "workout";
  if (/러닝|런닝|달리기|조깅|마라톤|산책|run|jog|walk/i.test(title)) return "run";
  return "normal";
}

function fromTask(t: Task, date: string): TimeBlock {
  return {
    id: t.id, // keep the id → existing outcomes/fires/latencies stay attached to their block
    date,
    start: t.setTime,
    title: t.title,
    kind: guessKind(t.title),
    executionAlarm: t.executionAlarm,
    alarmLeadMinutes: t.leadMinutes,
    microStartNote: t.microStartNote,
    skipped: (t.skippedDates ?? []).includes(date),
    snapStart: t.setTime,
    snapTitle: t.title,
    plannedAt: t.createdAt,
    status: "planned",
    createdAt: t.createdAt,
    updatedAt: Date.now(),
  };
}

/** Idempotent: runs at most once (it deletes the legacy key), and no-ops when there's nothing to move. */
async function ensureMigrated(): Promise<void> {
  const legacy = await AsyncStorage.getItem(LEGACY_KEY);
  if (!legacy) return;
  const existing = await AsyncStorage.getItem(KEY);
  try {
    const tasks = JSON.parse(legacy) as Task[];
    const blocks = existing ? (JSON.parse(existing) as TimeBlock[]) : [];
    const have = new Set(blocks.map((b) => b.id));
    const today = ymd(new Date());
    for (const t of tasks) {
      if (!have.has(t.id)) blocks.push(fromTask(t, today));
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(blocks));
  } catch {
    // corrupt legacy payload — drop it rather than block the app on it
  }
  await AsyncStorage.removeItem(LEGACY_KEY);
}

export async function listBlocks(): Promise<TimeBlock[]> {
  await ensureMigrated();
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as TimeBlock[]) : [];
}

export async function saveBlocks(blocks: TimeBlock[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(blocks));
}

export async function addBlock(block: TimeBlock): Promise<void> {
  await saveBlocks([...(await listBlocks()), block]);
}

export async function addBlocks(blocks: TimeBlock[]): Promise<void> {
  await saveBlocks([...(await listBlocks()), ...blocks]);
}

export async function updateBlock(block: TimeBlock): Promise<void> {
  const blocks = await listBlocks();
  await saveBlocks(blocks.map((b) => (b.id === block.id ? block : b)));
}

export async function deleteBlock(id: string): Promise<void> {
  const blocks = await listBlocks();
  await saveBlocks(blocks.filter((b) => b.id !== id));
}

/** A day's blocks in clock order — the day view and My Day both read the day this way. */
export function blocksOn(blocks: TimeBlock[], date: string): TimeBlock[] {
  return blocks.filter((b) => b.date === date).sort((a, b) => a.start.localeCompare(b.start));
}

/** Which days carry blocks → the calendar can mark them without re-filtering per cell. */
export function groupByDate(blocks: TimeBlock[]): Record<string, TimeBlock[]> {
  const by: Record<string, TimeBlock[]> = {};
  for (const b of blocks) (by[b.date] ??= []).push(b);
  for (const d of Object.keys(by)) by[d].sort((a, b) => a.start.localeCompare(b.start));
  return by;
}
