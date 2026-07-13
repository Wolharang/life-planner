// R3 — when an important event's soft advance alert fires. Pure time math only (the scheduling call
// itself is a best-effort expo-notifications side-effect, exercised on device).

import type { ImportantEvent } from "@/core/data/types";

const ev = (over: Partial<ImportantEvent> = {}): ImportantEvent => ({
  id: "event-1",
  title: "알바",
  date: "2026-08-01",
  time: "14:00",
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

const at = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo - 1, d, h, mi, 0, 0).getTime();

