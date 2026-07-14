package com.lifeplanner.lpalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager

/**
 * Fires at +5m / +15m to grab one location fix, even with the app dead. `getCurrentLocation` is async, so the
 * process must be kept alive across it: `goAsync()` holds the broadcast open and a short wakelock keeps the CPU
 * up; both are released the instant the fix lands (or is found impossible).
 */
class GeoReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val blockId = intent.getStringExtra(GeoScheduler.EXTRA_BLOCK) ?: return
    val date = intent.getStringExtra(GeoScheduler.EXTRA_DATE) ?: ""

    val pending = goAsync()
    val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    val wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "lp-alarm:geo")
      .apply { setReferenceCounted(false) }
    wakeLock.acquire(20_000L)

    GeoCapture.captureInto(context, blockId, date) {
      try {
        if (wakeLock.isHeld) wakeLock.release()
      } catch (e: Exception) {
        // already released
      }
      pending.finish()
    }
  }
}
