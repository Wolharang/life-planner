package com.lifeplanner.lpalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent

/**
 * Schedules the +5m / +15m location samples for a committed auto-eval block. It has its **own** receiver and
 * action, so it never touches the execution-alarm fire path. Best-effort by design: a dropped sample just means
 * fewer fixes to judge from (2 still decide moved-vs-stayed; <2 abstains).
 */
object GeoScheduler {
  const val ACTION_GEO = "com.lifeplanner.lpalarm.ACTION_GEO"
  const val EXTRA_BLOCK = "geoBlockId"
  const val EXTRA_DATE = "geoDate"

  private const val FLAGS = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT

  private val SLOTS = intArrayOf(1, 2)

  fun schedule(context: Context, blockId: String, date: String, at: Long, slot: Int) {
    val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val intent = Intent(context, GeoReceiver::class.java).apply {
      action = "$ACTION_GEO:$blockId:$slot" // unique per (block, slot) so the two samples don't collide
      putExtra(EXTRA_BLOCK, blockId)
      putExtra(EXTRA_DATE, date)
    }
    val pi = PendingIntent.getBroadcast(context, "$blockId#geo$slot".hashCode(), intent, FLAGS)
    try {
      am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
    } catch (e: SecurityException) {
      // Exact-alarm permission withheld — skip this sample. Auto-eval degrades, the app does not.
    }
  }

  /**
   * Cancel both pending samples for a block. Called when the block is deleted (JS `unscheduleBlock`): the
   * fire/re-check alarms are already cancelled there, and these must go too, or a deleted block would still
   * wake the phone twice to sample a location for a workout that no longer exists.
   */
  fun cancel(context: Context, blockId: String) {
    val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    for (slot in SLOTS) {
      val intent = Intent(context, GeoReceiver::class.java).apply { action = "$ACTION_GEO:$blockId:$slot" }
      val pi = PendingIntent.getBroadcast(context, "$blockId#geo$slot".hashCode(), intent, FLAGS)
      am.cancel(pi)
      pi.cancel()
    }
  }
}
