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
      Intent.ACTION_TIMEZONE_CHANGED -> reRegisterAll(context)
    }
  }

  private fun reRegisterAll(context: Context) {
    val now = System.currentTimeMillis()
    for (item in AlarmMirror.getAll(context)) {
      when {
        item.fireAt > now -> AlarmScheduler.schedule(context, item)
        item.recurrence != "none" -> {
          PendingMisses.record(context, item, now)
          val next = AlarmScheduler.nextFutureOccurrence(item, now)
          AlarmScheduler.schedule(context, item.copy(fireAt = next))
        }
        else -> {
          PendingMisses.record(context, item, now)
          AlarmMirror.remove(context, item.id)
        }
      }
    }
  }
}
