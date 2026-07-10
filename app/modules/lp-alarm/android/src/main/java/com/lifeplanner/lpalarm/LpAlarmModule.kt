package com.lifeplanner.lpalarm

import android.app.AlarmManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * JS ↔ native bridge for the exact-alarm lever (architecture §5 /core/notifications, exposed via the
 * Expo Modules API on the New Architecture). Scheduling/cancel are pure functions; the actual fire
 * happens in AlarmReceiver even when this module (and the whole JS process) is dead.
 */
class LpAlarmModule : Module() {

  companion object {
    private var instance: LpAlarmModule? = null

    /** Called from AlarmReceiver; a no-op when the JS side isn't running. */
    fun emitFired(id: String, title: String, intended: Long, firedAt: Long) {
      instance?.fire(id, title, intended, firedAt)
    }
  }

  private fun fire(id: String, title: String, intended: Long, firedAt: Long) {
    sendEvent(
      "onAlarmFired",
      mapOf(
        "id" to id,
        "title" to title,
        "intended" to intended.toDouble(),
        "firedAt" to firedAt.toDouble(),
        "deltaMs" to (firedAt - intended).toDouble()
      )
    )
  }

  private val context: Context
    get() = appContext.reactContext?.applicationContext
      ?: throw IllegalStateException("No Android context")

  override fun definition() = ModuleDefinition {
    Name("LpAlarm")

    Events("onAlarmFired")

    OnCreate {
      instance = this@LpAlarmModule
      AlarmBackupWorker.schedule(context) // §11 layer 3: periodic self-healing backup
    }
    OnDestroy { if (instance === this@LpAlarmModule) instance = null }

    // --- permission / OEM readiness (architecture §11 layer 2) ---

    Function("canScheduleExactAlarms") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).canScheduleExactAlarms()
      } else true
    }

    Function("isIgnoringBatteryOptimizations") {
      val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    // Android 14+ (API 34): full-screen intents are denied by default for non-calling/alarm apps,
    // degrading the alarm to a heads-up notification (screen stays off). Must be granted to pierce
    // the lock screen. This is THE gate for "screen turns on over the lock screen".
    Function("canUseFullScreenIntent") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.canUseFullScreenIntent()
      } else true
    }

    Function("openFullScreenIntentSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        startExternal(
          Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT)
            .setData(Uri.parse("package:" + context.packageName))
        )
      }
    }

    Function("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        startExternal(
          Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
            .setData(Uri.parse("package:" + context.packageName))
        )
      }
    }

    Function("requestIgnoreBatteryOptimizations") {
      @Suppress("BatteryLife")
      startExternal(
        Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
          .setData(Uri.parse("package:" + context.packageName))
      )
    }

    Function("openAppNotificationSettings") {
      startExternal(
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
          .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
      )
    }

    // --- scheduling ---

    Function("scheduleExactAlarm") { id: String, fireAt: Double, title: String, recurrence: String, note: String, createdAt: Double, leadMinutes: Int ->
      AlarmScheduler.schedule(context, AlarmItem(id, fireAt.toLong(), title, recurrence, note, createdAt.toLong(), leadMinutes))
    }

    Function("cancelAlarm") { id: String ->
      AlarmScheduler.cancel(context, id)
    }

    // §11 layers 3+5: run a synchronous backup scan now. Past-due alarms become R6 misses, not late FSI.
    Function("catchUp") {
      AlarmBackupWorker.runOnce(context)
    }

    // Read + clear the fired alarm's handoff (legacy RN handoff; the native ExecutionActivity now runs
    // the moment, so this is normally empty). Kept for the in-app preview path.
    Function("consumePendingExecution") {
      PendingExecution.consume(context)
    }

    // Drain outcomes recorded by the native execution moment (done) into the JS outcome store.
    Function("consumePendingOutcomes") {
      PendingOutcomes.consume(context)
    }

    // Drain "the moment appeared" markers (R6 catch-up + S1 latency) into the JS fire log.
    Function("consumePendingFires") {
      PendingFires.consume(context)
    }

    // Drain "never fired" missed occurrences into the JS catch-up store.
    Function("consumePendingMisses") {
      PendingMisses.consume(context)
    }

    // R8 sound setting (read natively at fire time; default off = haptic-only).
    Function("setSound") { enabled: Boolean ->
      SoundSetting.set(context, enabled)
    }
    Function("getSound") {
      SoundSetting.isOn(context)
    }

    Function("getScheduledAlarms") {
      AlarmMirror.getAll(context).map {
        mapOf(
          "id" to it.id,
          "fireAt" to it.fireAt.toDouble(),
          "title" to it.title,
          "recurrence" to it.recurrence,
          "note" to it.note,
          "createdAt" to it.createdAt.toDouble()
        )
      }
    }
  }

  private fun startExternal(intent: Intent) {
    try {
      val activity = appContext.currentActivity
      if (activity != null) {
        activity.startActivity(intent)
      } else {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      }
    } catch (e: Exception) {
      // Some OEMs/versions don't expose a given Settings action — ignore rather than crash the app.
    }
  }
}
