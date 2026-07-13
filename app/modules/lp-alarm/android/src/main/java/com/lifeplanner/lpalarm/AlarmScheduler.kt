package com.lifeplanner.lpalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import java.util.Calendar

/** One scheduled execution alarm. `recurrence` = "none" | "daily" | "weekly". */
data class AlarmItem(
  val id: String,
  val fireAt: Long,     // epoch millis of the intended fire time (= set time − lead)
  val title: String,
  val recurrence: String,
  val note: String = "",       // micro-start note (e.g. "지금 신발 신기")
  val createdAt: Long = 0L,    // when the task was created — for the time-accurate commit line
  val leadMinutes: Int = 0,    // set − lead = fireAt; carried so the commit line shows the SET time (PRD R3)
  val mode: String = "commit", // "commit" (normal moment) | "recheck" (the ~5-min "진짜 했어?" follow-up)
  val sound: Boolean = false,  // per-block (D43): does the moment ring? The TONE itself is a global setting.
  /**
   * **D65 — 무음.** `false` = the moment takes the screen and says **nothing**: no tone *and* no buzz.
   * A vibration is not free. A block that exists only so the day is honest (강의, 이동) must be able to appear
   * without buzzing your leg for the twentieth time, and every needless buzz spends the budget that keeps the
   * one loud thing loud (C1/D30). The screen IS the intervention; the noise was only ever its escort.
   */
  val vibrate: Boolean = true,
  /**
   * The day the OUTCOME belongs to (YYYY-MM-DD), when it cannot be derived from `fireAt`.
   *
   * A commit alarm can derive it (`fireAt + lead` = the block's start), but the **re-check** cannot: its
   * `fireAt` is just "commit + 5 minutes". Near midnight that lands on the **next day**, so a 23:58 block
   * answered "응, 했어" at 00:03 recorded its DONE against **tomorrow** — leaving today's occurrence forever
   * unanswered, until the catch-up net auto-archived it as a **miss the user had explicitly denied**. So the
   * re-check carries the original day with it.
   */
  val occurrenceDate: String = "",
  /**
   * The **wall clock** this alarm means: the local date and the minute-of-day it should fire at.
   *
   * `fireAt` is an absolute instant, and that is the wrong thing to preserve. A block's `start` is a
   * wall-clock time (data-model §2.3: "절대시각 아님") — "21:00 헬스" means nine in the evening *wherever you
   * are*. The mirror stored only the epoch, so `BootReceiver`'s TIMEZONE_CHANGED handler re-armed the **same
   * instant** in the new zone: fly to a zone an hour ahead and the moment arrives at 22:00 local. The layer
   * built to survive a timezone change was doing the one thing a timezone change must undo.
   *
   * Filled in at schedule time from `fireAt` in the *then-current* zone, so nothing upstream has to know.
   */
  val wallDate: String = "",
  val wallMinute: Int = -1
)

object LpAlarmConstants {
  const val CHANNEL_ID = "lp_exec_alarm"
  const val ACTION_FIRE = "com.lifeplanner.lpalarm.ACTION_FIRE"
  const val EXTRA_ID = "id"
  const val EXTRA_TITLE = "title"
  const val EXTRA_RECURRENCE = "recurrence"
  const val EXTRA_INTENDED = "intended"
  const val EXTRA_NOTE = "note"
  const val EXTRA_CREATED = "createdAt"
  const val EXTRA_LEAD = "leadMinutes"
  const val EXTRA_MODE = "mode"
  const val EXTRA_SOUND = "sound"
  const val EXTRA_DATE = "occurrenceDate"
  const val EXTRA_VIBRATE = "vibrate"
}

/**
 * The spine (architecture §4): schedules the exact-time alarm with AlarmManager.setAlarmClock()
 * — the highest-reliability path that wakes through Doze (tech-feasibility §1.1). One-shot per
 * setAlarmClock(); recurrence is re-armed on fire (§4.1) and on reboot (BootReceiver).
 */
object AlarmScheduler {

  /** Record what wall-clock time this alarm means, as read in the CURRENT zone. */
  private fun stampWallClock(item: AlarmItem): AlarmItem {
    if (item.wallMinute >= 0) return item
    val c = Calendar.getInstance().apply { timeInMillis = item.fireAt }
    return item.copy(
      wallDate = String.format(
        "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH)
      ),
      wallMinute = c.get(Calendar.HOUR_OF_DAY) * 60 + c.get(Calendar.MINUTE)
    )
  }

  /**
   * Re-derive the instant a wall-clock alarm means, **in whatever zone we are in now**. Used when the zone or
   * the clock changes: a 21:00 block must still fire at 21:00, not at the instant 21:00 used to be.
   *
   * A **re-check** is deliberately excluded: it is a genuine "5 minutes from the commit", an interval and not
   * an appointment, so its absolute instant is the correct thing to keep.
   */
  fun retimeForCurrentZone(item: AlarmItem): AlarmItem {
    if (item.mode == "recheck" || item.wallMinute < 0 || item.wallDate.isEmpty()) return item
    val parts = item.wallDate.split("-")
    if (parts.size != 3) return item
    val c = Calendar.getInstance().apply {
      set(Calendar.YEAR, parts[0].toInt())
      set(Calendar.MONTH, parts[1].toInt() - 1)
      set(Calendar.DAY_OF_MONTH, parts[2].toInt())
      set(Calendar.HOUR_OF_DAY, item.wallMinute / 60)
      set(Calendar.MINUTE, item.wallMinute % 60)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }
    return item.copy(fireAt = c.timeInMillis)
  }

  private const val IMMUTABLE_UPDATE =
    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT

  fun schedule(context: Context, rawItem: AlarmItem, persist: Boolean = true) {
    val item = stampWallClock(rawItem)
    val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val info = AlarmManager.AlarmClockInfo(item.fireAt, showPendingIntent(context, item))
    try {
      am.setAlarmClock(info, firePendingIntent(context, item))
    } catch (e: SecurityException) {
      // Exact-alarm permission not granted (Android 12+). NOTHING is armed.
      //
      // We must not mirror it anyway. The mirror is what `getScheduledAlarms()` reports, and JS trusts that
      // report: `pastUnfiredBlocks` treats a mirrored block as "armed" and therefore **excludes it from the
      // never-fired catch-up net**. So a block that failed to arm used to look armed, never fire, and never
      // be caught — the R6 net disarmed by the very failure it exists to catch. Leaving it out of the mirror
      // means the net sees it. The repository re-arms everything from storage on app open, so a later grant
      // still recovers it.
      AlarmMirror.remove(context, item.id)
      return
    }
    if (persist) AlarmMirror.put(context, item)
  }

  /**
   * Show the surface + advance recurrence / evict one-shot + notify JS. Shared by AlarmReceiver
   * (exact fire) and AlarmBackupWorker (catch-up), so both paths behave identically.
   */
  fun fireNow(context: Context, item: AlarmItem, firedAt: Long) {
    AlarmNotifications.showFullScreen(context, item)
    if (item.recurrence != "none") {
      schedule(context, item.copy(fireAt = nextFutureOccurrence(item, firedAt)))
    } else {
      AlarmMirror.remove(context, item.id)
    }
    LpAlarmModule.emitFired(item.id, item.title, item.fireAt, firedAt)
  }

  fun cancel(context: Context, id: String) {
    val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val intent = Intent(context, AlarmReceiver::class.java).apply {
      action = LpAlarmConstants.ACTION_FIRE + ":" + id
    }
    val pi = PendingIntent.getBroadcast(context, id.hashCode(), intent, IMMUTABLE_UPDATE)
    am.cancel(pi)
    pi.cancel()
    AlarmMirror.remove(context, id)
  }

  /** Broadcast to AlarmReceiver at fire time. Unique action per id keeps PendingIntents distinct. */
  private fun firePendingIntent(context: Context, item: AlarmItem): PendingIntent {
    val intent = Intent(context, AlarmReceiver::class.java).apply {
      action = LpAlarmConstants.ACTION_FIRE + ":" + item.id
      putExtra(LpAlarmConstants.EXTRA_ID, item.id)
      putExtra(LpAlarmConstants.EXTRA_TITLE, item.title)
      putExtra(LpAlarmConstants.EXTRA_RECURRENCE, item.recurrence)
      putExtra(LpAlarmConstants.EXTRA_INTENDED, item.fireAt)
      putExtra(LpAlarmConstants.EXTRA_NOTE, item.note)
      putExtra(LpAlarmConstants.EXTRA_CREATED, item.createdAt)
      putExtra(LpAlarmConstants.EXTRA_LEAD, item.leadMinutes)
      putExtra(LpAlarmConstants.EXTRA_MODE, item.mode)
      putExtra(LpAlarmConstants.EXTRA_SOUND, item.sound)
      putExtra(LpAlarmConstants.EXTRA_DATE, item.occurrenceDate)
      putExtra(LpAlarmConstants.EXTRA_VIBRATE, item.vibrate)
      putExtra(LpAlarmConstants.EXTRA_VIBRATE, item.vibrate)
    }
    return PendingIntent.getBroadcast(context, item.id.hashCode(), intent, IMMUTABLE_UPDATE)
  }

  /** Tapping the status-bar alarm icon opens the execution surface. Carries the SAME payload as the
   *  fire path (note + createdAt + lead) so the commit line stays time-accurate and the micro-start
   *  note shows on this entry path too (not just the full-screen-intent path). */
  private fun showPendingIntent(context: Context, item: AlarmItem): PendingIntent {
    val intent = Intent(context, ExecutionActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtra(LpAlarmConstants.EXTRA_ID, item.id)
      putExtra(LpAlarmConstants.EXTRA_TITLE, item.title)
      putExtra(LpAlarmConstants.EXTRA_INTENDED, item.fireAt)
      putExtra(LpAlarmConstants.EXTRA_NOTE, item.note)
      putExtra(LpAlarmConstants.EXTRA_CREATED, item.createdAt)
      putExtra(LpAlarmConstants.EXTRA_LEAD, item.leadMinutes)
      putExtra(LpAlarmConstants.EXTRA_MODE, item.mode)
      putExtra(LpAlarmConstants.EXTRA_SOUND, item.sound)
      putExtra(LpAlarmConstants.EXTRA_DATE, item.occurrenceDate)
      putExtra(LpAlarmConstants.EXTRA_VIBRATE, item.vibrate)
      putExtra(LpAlarmConstants.EXTRA_VIBRATE, item.vibrate)
    }
    return PendingIntent.getActivity(context, item.id.hashCode() + 1, intent, IMMUTABLE_UPDATE)
  }

  /**
   * Next occurrence strictly after `now`, preserving local wall-clock time.
   *
   * Skip-unaware BY DESIGN: it never consults skippedDates. This is safe because skips are today-only
   * (the R1 "오늘은 쉼" toggle only ever adds *today*, and every toggle re-arms via JS nextEffectiveFireAt,
   * which IS skip-aware) — a native advance always lands on a strictly-future date, which can never be a
   * date the user already skipped. If per-occurrence (future-date) skips are ever added (PRD R1 lists the
   * toggle per upcoming occurrence), carry the skip set into AlarmItem/AlarmMirror and skip it here too.
   */
  fun nextFutureOccurrence(item: AlarmItem, now: Long): Long {
    if (item.recurrence == "none") return item.fireAt
    val cal = Calendar.getInstance().apply { timeInMillis = item.fireAt }
    val step = if (item.recurrence == "weekly") Calendar.WEEK_OF_YEAR else Calendar.DAY_OF_YEAR
    val amount = 1
    while (cal.timeInMillis <= now) cal.add(step, amount)
    return cal.timeInMillis
  }
}
