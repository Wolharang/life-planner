// JS side of the exact-alarm lever (architecture §5 /core/notifications). Talks to the autolinked
// local native module "LpAlarm" (app/modules/lp-alarm). Feature code depends on THIS interface, not
// on the native module directly, so the implementation can evolve without touching features.

import { requireNativeModule, type EventSubscription } from "expo-modules-core";

export type Recurrence = "none" | "daily" | "weekly";

export type ScheduledAlarm = {
  id: string;
  fireAt: number; // epoch ms
  title: string;
  recurrence: Recurrence;
  note?: string;
  createdAt?: number;
};

export type AlarmFiredEvent = {
  id: string;
  title: string;
  intended: number; // epoch ms
  firedAt: number; // epoch ms
  deltaMs: number; // firedAt - intended
};

export type PendingExecution = {
  taskId: string;
  title: string;
  note: string;
  intended: number;
  createdAt: number;
};

export type PendingOutcome = {
  taskId: string;
  title: string;
  date: string;
  status: string; // "done" (from the native execution moment)
  at: number;
};

export type FiredMarker = {
  taskId: string;
  title: string;
  date: string;
  intended: number;
  firedAt: number;
  deltaMs: number;
};

export type MissedMarker = {
  taskId: string;
  title: string;
  date: string;
  intended: number;
  missedAt: number;
};

// Untyped native surface; the typed API below is what the app uses.
const Native = requireNativeModule("LpAlarm") as any;

export const alarm = {
  /** Android 12+: whether exact alarms may be scheduled (else openExactAlarmSettings()). */
  canScheduleExactAlarms(): boolean {
    return Native.canScheduleExactAlarms();
  },
  isIgnoringBatteryOptimizations(): boolean {
    return Native.isIgnoringBatteryOptimizations();
  },
  openExactAlarmSettings(): void {
    Native.openExactAlarmSettings();
  },
  requestIgnoreBatteryOptimizations(): void {
    Native.requestIgnoreBatteryOptimizations();
  },
  openAppNotificationSettings(): void {
    Native.openAppNotificationSettings();
  },
  /**
   * Android 14+: whether the alarm may pierce the lock screen (else it degrades to a heads-up).
   * Guarded so a JS-ahead-of-native dev skew reports "unknown" (false → prompts a rebuild+grant)
   * instead of crashing the screen.
   */
  canUseFullScreenIntent(): boolean {
    return typeof Native.canUseFullScreenIntent === "function"
      ? Native.canUseFullScreenIntent()
      : false;
  },
  openFullScreenIntentSettings(): void {
    Native.openFullScreenIntentSettings?.();
  },

  schedule(opts: {
    id: string;
    fireAt: number;
    title: string;
    recurrence?: Recurrence;
    note?: string;
    createdAt?: number;
    /** minutes the effective fire time is ahead-shifted (set − lead = fireAt); carried so the native
     *  commit line can show the SET time, not the effective time (PRD R3). */
    leadMinutes?: number;
  }): void {
    Native.scheduleExactAlarm(
      opts.id,
      opts.fireAt,
      opts.title,
      opts.recurrence ?? "none",
      opts.note ?? "",
      opts.createdAt ?? Date.now(),
      opts.leadMinutes ?? 0
    );
  },
  cancel(id: string): void {
    Native.cancelAlarm(id);
  },
  /** Kick a one-shot backup scan that fires any missed alarm — call on app open (§11 layers 3+5). */
  catchUp(): void {
    Native.catchUp?.();
  },
  /** Read + clear a fired alarm's handoff (legacy RN handoff; native moment normally handles it). */
  consumePendingExecution(): PendingExecution | null {
    return (Native.consumePendingExecution?.() as PendingExecution | null) ?? null;
  },
  /** Drain outcomes the native execution moment recorded (over-lock) so the app can persist them. */
  consumePendingOutcomes(): PendingOutcome[] {
    return (Native.consumePendingOutcomes?.() as PendingOutcome[] | undefined) ?? [];
  },
  /** Drain "the moment appeared" markers (R6 catch-up net + S1 fire latency). */
  consumePendingFires(): FiredMarker[] {
    return (Native.consumePendingFires?.() as FiredMarker[] | undefined) ?? [];
  },
  /** Drain R6 "never fired" markers produced by the native backup/boot scans. */
  consumePendingMisses(): MissedMarker[] {
    return (Native.consumePendingMisses?.() as MissedMarker[] | undefined) ?? [];
  },

  /** R8: execution-moment sound (default off = haptic-only). Stored natively for fire-time reads. */
  getSound(): boolean {
    return (Native.getSound?.() as boolean | undefined) ?? false;
  },
  setSound(enabled: boolean): void {
    Native.setSound?.(enabled);
  },
  getScheduled(): ScheduledAlarm[] {
    return Native.getScheduledAlarms();
  },

  /** Fires only while the JS process is alive (measurement); the alarm itself fires regardless. */
  addFiredListener(listener: (e: AlarmFiredEvent) => void): EventSubscription {
    return Native.addListener("onAlarmFired", listener);
  },
};
