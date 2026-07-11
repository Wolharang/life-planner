package com.lifeplanner.lpalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager

/**
 * Fires at the exact time (architecture §4). Pierces the lock screen via the full-screen-intent
 * notification, re-arms the next occurrence for recurring alarms (§4.1), and — if the JS side is
 * alive — emits onAlarmFired for measurement.
 */
class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val id = intent.getStringExtra(LpAlarmConstants.EXTRA_ID) ?: return
    val title = intent.getStringExtra(LpAlarmConstants.EXTRA_TITLE) ?: "실행"
    val recurrence = intent.getStringExtra(LpAlarmConstants.EXTRA_RECURRENCE) ?: "none"
    val intended = intent.getLongExtra(LpAlarmConstants.EXTRA_INTENDED, System.currentTimeMillis())
    val note = intent.getStringExtra(LpAlarmConstants.EXTRA_NOTE) ?: ""
    val createdAt = intent.getLongExtra(LpAlarmConstants.EXTRA_CREATED, 0L)
    val leadMinutes = intent.getIntExtra(LpAlarmConstants.EXTRA_LEAD, 0)
    val mode = intent.getStringExtra(LpAlarmConstants.EXTRA_MODE) ?: "commit"
    val firedAt = System.currentTimeMillis()

    val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    val wakeLock = pm.newWakeLock(
      PowerManager.PARTIAL_WAKE_LOCK,
      "lp-alarm:fire"
    ).apply { setReferenceCounted(false) }

    try {
      wakeLock.acquire(15_000L)

      // Pierce the lock screen, re-arm recurrence / evict one-shot, and report to JS if alive.
      AlarmScheduler.fireNow(context, AlarmItem(id, intended, title, recurrence, note, createdAt, leadMinutes, mode), firedAt)
    } finally {
      if (wakeLock.isHeld) wakeLock.release()
    }
  }
}
