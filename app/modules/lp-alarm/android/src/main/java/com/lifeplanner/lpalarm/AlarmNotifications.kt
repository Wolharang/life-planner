package com.lifeplanner.lpalarm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

/**
 * Builds the category=ALARM full-screen-intent notification that pierces the lock screen and launches
 * ExecutionActivity — our own activity (no custom-scheme deep link, which the dev-client launcher
 * would intercept). Silent by default (R8 §4.1: sound off unless the user enables it) — a silent
 * channel + haptics. The RN handoff is via PendingExecution (read on app launch).
 */
object AlarmNotifications {

  /**
   * Remove the notification that launched (or would launch) an occurrence.
   *
   * **Why this is mandatory, not tidiness:** the full-screen-intent notification stays in the shade after
   * the moment is over. Tapping that stale notification **re-runs the whole occurrence** — the user saw
   * "진짜 했어?" a second time after already answering — and, worse, re-opening a stale *commit* would arm
   * a **second** 5-min re-check. The moment must be a one-shot: the activity cancels its own notification
   * the instant it takes over, and again when it dismisses.
   */
  fun cancel(context: Context, alarmId: String) {
    try {
      NotificationManagerCompat.from(context).cancel(alarmId.hashCode())
    } catch (e: Exception) {
      // best-effort
    }
  }

  fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val mgr = context.getSystemService(NotificationManager::class.java)
    if (mgr.getNotificationChannel(LpAlarmConstants.CHANNEL_ID) != null) return
    val channel = NotificationChannel(
      LpAlarmConstants.CHANNEL_ID,
      "실행 알람",
      NotificationManager.IMPORTANCE_HIGH
    ).apply {
      description = "정확한 시각에 실행 화면을 띄웁니다."
      setSound(null, null) // silent channel (default off); haptics carry the cue
      enableVibration(true)
      vibrationPattern = longArrayOf(0, 400, 200, 400)
      setBypassDnd(true)
      lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
    }
    mgr.createNotificationChannel(channel)
  }

  fun showFullScreen(context: Context, item: AlarmItem) {
    ensureChannel(context)

    val fullScreenIntent = Intent(context, ExecutionActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtra(LpAlarmConstants.EXTRA_ID, item.id)
      putExtra(LpAlarmConstants.EXTRA_TITLE, item.title)
      putExtra(LpAlarmConstants.EXTRA_NOTE, item.note)
      putExtra(LpAlarmConstants.EXTRA_INTENDED, item.fireAt)
      putExtra(LpAlarmConstants.EXTRA_CREATED, item.createdAt)
      putExtra(LpAlarmConstants.EXTRA_LEAD, item.leadMinutes)
      putExtra(LpAlarmConstants.EXTRA_MODE, item.mode)
      putExtra(LpAlarmConstants.EXTRA_SOUND, item.sound)
    }
    val fsPending = PendingIntent.getActivity(
      context,
      item.id.hashCode() + 2,
      fullScreenIntent,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )

    // **The way back.** D47's design is "insist, never trap": the moment re-summons itself up to 3 times, and
    // after that **the notification is how you return to it**. Except it wasn't — the builder set a
    // fullScreenIntent but **no contentIntent**, so tapping the notification did **nothing at all**. Once the
    // user had sent the moment away three times (or the overlay grant was missing, so the background start was
    // refused), the unanswered occurrence was **unreachable**, and its notification sat in the shade as an
    // inert, permanent row that only `dismiss()` could clear — and `dismiss()`, by definition, never ran.
    // The safety net the whole re-summon design leans on did not exist.
    val tapPending = PendingIntent.getActivity(
      context,
      item.id.hashCode() + 3,
      fullScreenIntent,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )

    val notification = NotificationCompat.Builder(context, LpAlarmConstants.CHANNEL_ID)
      .setContentIntent(tapPending)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle("지금 — ${item.title}")
      .setContentText("실행할 시간이에요")
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setFullScreenIntent(fsPending, true)
      .setAutoCancel(true)
      .setOngoing(false)
      .build()

    try {
      NotificationManagerCompat.from(context).notify(item.id.hashCode(), notification)
    } catch (e: SecurityException) {
      // POST_NOTIFICATIONS not granted (Android 13+): the app must drive openAppNotificationSettings().
    }

    // Belt-and-suspenders: when the process may start activities (screen on / foreground), launch
    // directly too. Harmless if the background-launch is blocked (the FSI notification covers that).
    try {
      context.startActivity(fullScreenIntent)
    } catch (e: Exception) {
      // background activity start blocked — the full-screen-intent notification is the real path.
    }
  }
}
