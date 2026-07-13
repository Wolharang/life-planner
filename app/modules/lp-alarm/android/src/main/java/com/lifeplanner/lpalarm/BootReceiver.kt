package com.lifeplanner.lpalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Self-registration layer (architecture §11 layer 4): after reboot / app update / time / timezone
 * change, re-arm every alarm from the native mirror — without any JS running. Future one-shots and
 * recurring alarms are re-armed; recurring alarms whose time already passed advance to the next
 * occurrence. Past one-shots are recorded for the JS catch-up sweep (§11 layer 5).
 */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_MY_PACKAGE_REPLACED,
      "android.intent.action.TIME_SET",
      Intent.ACTION_TIMEZONE_CHANGED,
      // Android 12+: the user just GRANTED exact alarms. Everything scheduled while it was denied is
      // unarmed (AlarmScheduler swallows the SecurityException and refuses to mirror a failed arm), so
      // without this the lever stayed silently dead until the app happened to be opened. §11 layer 4
      // claimed this broadcast; nothing had ever registered it.
      "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED" -> reRegisterAll(context)
    }
  }

  /**
   * **Re-derive the instant from the wall clock, don't preserve the instant.**
   *
   * A block's `start` is a wall-clock time — "21:00 헬스" means nine in the evening *wherever you are*
   * (data-model §2.3). The mirror used to carry only the epoch, so this handler re-armed the **same instant**
   * after a timezone change: fly one zone east and the moment arrives at 22:00 local. The layer that exists
   * to survive a timezone change was doing exactly what a timezone change must undo. Same for DST, and for a
   * user correcting a wrong system clock.
   *
   * `retimeForCurrentZone` recomputes the epoch from the wall clock the alarm actually means. It leaves a
   * **re-check** alone: that one is a true interval ("5 minutes after the commit"), not an appointment.
   */
  private fun reRegisterAll(context: Context) {
    val now = System.currentTimeMillis()
    for (mirrored in AlarmMirror.getAll(context)) {
      val item = AlarmScheduler.retimeForCurrentZone(mirrored)
      when {
        item.fireAt > now -> AlarmScheduler.schedule(context, item)
        item.recurrence != "none" -> {
          if (!isRecheck(item.id)) PendingMisses.record(context, item, now)
          val next = AlarmScheduler.nextFutureOccurrence(item, now)
          AlarmScheduler.schedule(context, item.copy(fireAt = next))
        }
        else -> {
          // A re-check that died with the process is not a missed occurrence (isRecheck) — the commit's
          // fire marker already stands for it, and the catch-up net will ask.
          if (!isRecheck(item.id)) PendingMisses.record(context, item, now)
          AlarmMirror.remove(context, item.id)
        }
      }
    }
  }
}
