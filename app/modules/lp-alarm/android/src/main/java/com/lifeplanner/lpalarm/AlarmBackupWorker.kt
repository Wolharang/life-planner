package com.lifeplanner.lpalarm

import android.content.Context
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * §11 layer 3 — self-healing backup. `setAlarmClock` is the primary path; if an OEM / Doze drops it,
 * the mirror entry stays PAST-DUE (a correct fire removes or advances it). This worker records those
 * as R6 "never fired" misses, then advances/removes the mirror entry. It must NOT fire the full-screen
 * execution surface late: PRD §7.2 explicitly excludes snooze / re-fire, and R6 owns missed recovery.
 */
class AlarmBackupWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

  override fun doWork(): Result {
    scan(applicationContext)
    return Result.success()
  }

  companion object {
    private const val UNIQUE = "lp-alarm-backup"
    private const val GRACE_MS = 30_000L

    fun scan(context: Context) {
      val now = System.currentTimeMillis()
      for (item in AlarmMirror.getAll(context)) {
        when {
          item.fireAt <= now - GRACE_MS -> {
            PendingMisses.record(context, item, now)
            if (item.recurrence != "none") {
              AlarmScheduler.schedule(context, item.copy(fireAt = AlarmScheduler.nextFutureOccurrence(item, now)))
            } else {
              AlarmMirror.remove(context, item.id)
            }
          }
          item.fireAt > now -> AlarmScheduler.schedule(context, item) // ensure still armed
        }
      }
    }

    fun schedule(context: Context) {
      val request = PeriodicWorkRequestBuilder<AlarmBackupWorker>(15, TimeUnit.MINUTES).build()
      WorkManager.getInstance(context)
        .enqueueUniquePeriodicWork(UNIQUE, ExistingPeriodicWorkPolicy.KEEP, request)
    }

    fun runOnce(context: Context) {
      scan(context)
    }
  }
}
