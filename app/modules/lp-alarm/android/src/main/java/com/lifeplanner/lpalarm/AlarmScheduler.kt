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
  val sound: Boolean = false,  // per-block (D43): false = vibration only. The TONE itself is a global setting.
  /**
   * The day the OUTCOME belongs to (YYYY-MM-DD), when it cannot be derived from `fireAt`.
   *
   * A commit alarm can derive it (`fireAt + lead` = the block's start), but the **re-check** cannot: its
   * `fireAt` is just "commit + 5 minutes". Near midnight that lands on the **next day**, so a 23:58 block
   * answered "응, 했어" at 00:03 recorded its DONE against **tomorrow** — leaving today's occurrence forever
   * unanswered, until the catch-up net auto-archived it as a **miss the user had explicitly denied**. So the
   * re-check carries the original day with it.
   */
  val occurrenceDate: String = ""
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
}

/**
 * The spine (architecture §4): schedules the exact-time alarm with AlarmManager.setAlarmClock()
 * — the highest-reliability path that wakes through Doze (tech-feasibility §1.1). One-shot per
 * setAlarmClock(); recurrence is re-armed on fire (§4.1) and on reboot (BootReceiver).
 */
object AlarmScheduler {

  private const val IMMUTABLE_UPDATE =
    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT

  fun schedule(context: Context, item: AlarmItem, persist: Boolean = true) {
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
