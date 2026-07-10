package com.lifeplanner.lpalarm

import android.content.Context

/**
 * R8 sound setting — read by the native execution moment at fire time (JS may be dead), so it lives
 * natively (SharedPreferences). Default OFF (haptic-only). The Settings screen writes it via
 * LpAlarmModule.setSound.
 */
object SoundSetting {
  private const val PREFS = "lp_settings"
  private const val KEY = "sound"

  fun isOn(context: Context): Boolean = prefs(context).getBoolean(KEY, false)

  fun set(context: Context, on: Boolean) {
    prefs(context).edit().putBoolean(KEY, on).apply()
  }

  private fun prefs(context: Context) =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
