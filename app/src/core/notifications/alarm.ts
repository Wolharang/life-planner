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

export type GeoSampleGroup = {
  blockId: string;
  date: string;
  samples: { lat: number; lng: number; at: number }[];
};

/**
 * Untyped native surface, resolved **lazily**.
 *
 * This used to be `const Native = requireNativeModule("LpAlarm")` at module scope — which **throws at import
 * time** when the module isn't linked (Expo Go, a dev build made before `prebuild`). `blockRepository` imports
 * this file and `app/_layout` imports `blockRepository`, so the root layout's module graph blew up and the app
 * showed a white screen. Worse, it made **liars of every guard in the codebase**: the `try { alarm.getSound() }
 * catch { /* native not linked * / }` blocks in settings, onboarding, add-block, home and the repository were
 * unreachable — the import had already killed the app.
 *
 * Lazily, the throw happens at the *call*, which is exactly where those guards are waiting for it. A missing
 * native module now costs the alarm, not the app.
 */
let cached: any;
function Native(): any {
  if (!cached) cached = requireNativeModule("LpAlarm") as any;
  return cached;
}

export const alarm = {
  /** Android 12+: whether exact alarms may be scheduled (else openExactAlarmSettings()). */
  canScheduleExactAlarms(): boolean {
    return Native().canScheduleExactAlarms();
  },
  isIgnoringBatteryOptimizations(): boolean {
    return Native().isIgnoringBatteryOptimizations();
  },
  openExactAlarmSettings(): void {
    Native().openExactAlarmSettings();
  },
  requestIgnoreBatteryOptimizations(): void {
    Native().requestIgnoreBatteryOptimizations();
  },
  openAppNotificationSettings(): void {
    Native().openAppNotificationSettings();
  },
  /**
   * Android 14+: whether the alarm may pierce the lock screen (else it degrades to a heads-up).
   * Guarded so a JS-ahead-of-native dev skew reports "unknown" (false → prompts a rebuild+grant)
   * instead of crashing the screen.
   */
  canUseFullScreenIntent(): boolean {
    return typeof Native().canUseFullScreenIntent === "function"
      ? Native().canUseFullScreenIntent()
      : false;
  },
  openFullScreenIntentSettings(): void {
    Native().openFullScreenIntentSettings?.();
  },

  /**
   * "다른 앱 위에 표시". Without it the moment only takes over when the screen is **off/locked**: on an
   * unlocked, in-use phone Android degrades the full-screen intent to a heads-up banner and blocks our
   * direct activity start, so the moment appears only if the user taps the notification — which is not
   * the lever (it makes execution opt-in at exactly the point the user is trying to avoid it).
   */
  canDrawOverlays(): boolean {
    return typeof Native().canDrawOverlays === "function" ? Native().canDrawOverlays() : false;
  },
  openOverlaySettings(): void {
    Native().openOverlaySettings?.();
  },

  // --- sound (read natively at fire time; OFF = vibration only) ---
  /** The device's alarm/notification tones for the settings picker. */
  listAlarmTones(): { title: string; uri: string }[] {
    return typeof Native().listAlarmTones === "function" ? Native().listAlarmTones() : [];
  },
  /** "" = follow the device's default alarm tone. */
  getAlarmTone(): string {
    return typeof Native().getAlarmTone === "function" ? Native().getAlarmTone() : "";
  },
  setAlarmTone(uri: string): void {
    Native().setAlarmTone?.(uri);
  },
  previewTone(uri: string): void {
    Native().previewTone?.(uri);
  },
  stopPreview(): void {
    Native().stopPreview?.();
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
    /** D65 — how loudly the moment announces itself: `"silent" | "vibrate" | "sound"`. 무음 means it takes the
     *  screen and says **nothing**: no tone, no buzz. The tone itself is a global setting (D42). */
    loudness?: "silent" | "vibrate" | "sound";
  }): void {
    Native().scheduleExactAlarm(
      opts.id,
      opts.fireAt,
      opts.title,
      opts.recurrence ?? "none",
      opts.note ?? "",
      opts.createdAt ?? Date.now(),
      opts.leadMinutes ?? 0,
      opts.loudness ?? "vibrate"
    );
  },
  cancel(id: string): void {
    Native().cancelAlarm(id);
  },

  // --- GPS auto-evaluation (workout/run 실행 blocks) ---
  /** Mark whether this block auto-evaluates by location. Read natively at commit, so it must be set at
   *  schedule time — before any moment fires. Silent no-op if the native module is a step behind. */
  setAutoEval(id: string, on: boolean): void {
    Native().setAutoEval?.(id, on);
  },
  /** The GPS fixes captured natively at commit / +5m / +15m, grouped per occurrence. Cleared via
   *  `clearGeoSamples` once JS has turned them into a verdict — the raw coordinates never persist. */
  getGeoSamples(): { blockId: string; date: string; samples: { lat: number; lng: number; at: number }[] }[] {
    return (Native().getGeoSamples?.() as GeoSampleGroup[] | undefined) ?? [];
  },
  clearGeoSamples(blockId: string, date: string): void {
    Native().clearGeoSamples?.(blockId, date);
  },
  /** A deleted block: cancel its +5/+15 sample alarms and drop anything already captured. */
  cancelGeoCaptures(blockId: string): void {
    Native().cancelGeoCaptures?.(blockId);
  },
  /** Kick a one-shot backup scan that fires any missed alarm — call on app open (§11 layers 3+5). */
  catchUp(): void {
    Native().catchUp?.();
  },
  /** Read + clear a fired alarm's handoff (legacy RN handoff; native moment normally handles it). */
  consumePendingExecution(): PendingExecution | null {
    return (Native().consumePendingExecution?.() as PendingExecution | null) ?? null;
  },
  /** Drain outcomes the native execution moment recorded (over-lock) so the app can persist them. */
  consumePendingOutcomes(): PendingOutcome[] {
    return (Native().consumePendingOutcomes?.() as PendingOutcome[] | undefined) ?? [];
  },
  /** Drain "the moment appeared" markers (R6 catch-up net + S1 fire latency). */
  consumePendingFires(): FiredMarker[] {
    return (Native().consumePendingFires?.() as FiredMarker[] | undefined) ?? [];
  },
  /** Drain R6 "never fired" markers produced by the native backup/boot scans. */
  consumePendingMisses(): MissedMarker[] {
    return (Native().consumePendingMisses?.() as MissedMarker[] | undefined) ?? [];
  },

  /** R8: execution-moment sound (default off = haptic-only). Stored natively for fire-time reads. */
  getSound(): boolean {
    return (Native().getSound?.() as boolean | undefined) ?? false;
  },
  setSound(enabled: boolean): void {
    Native().setSound?.(enabled);
  },
  getScheduled(): ScheduledAlarm[] {
    return Native().getScheduledAlarms();
  },

  /** Fires only while the JS process is alive (measurement); the alarm itself fires regardless. */
  addFiredListener(listener: (e: AlarmFiredEvent) => void): EventSubscription {
    return Native().addListener("onAlarmFired", listener);
  },
};
