package com.lifeplanner.lpalarm

import android.content.Context
import android.media.RingtoneManager
import android.net.Uri

/**
 * The execution moment's sound settings — read **natively at fire time** (JS may be dead), so they live
 * here in SharedPreferences, not in the JS store.
 *
 * Two independent things (founder, 2026-07-11):
 *  · **on/off** — off (the default) = **vibration only**. C1: the app is quiet unless asked.
 *  · **which tone** — an alarm tone the user picked (`toneUri`). Empty = the device's default alarm tone.
 * Vibration always accompanies the moment; sound is the opt-in layer on top.
 */
object SoundSetting {
  private const val PREFS = "lp_settings"
  private const val KEY_ON = "sound"
  private const val KEY_TONE = "sound_tone_uri"

  fun isOn(context: Context): Boolean = prefs(context).getBoolean(KEY_ON, false)

  fun set(context: Context, on: Boolean) {
    prefs(context).edit().putBoolean(KEY_ON, on).apply()
  }

  /** The chosen tone, or "" = follow the device's default alarm tone. */
  fun toneUri(context: Context): String = prefs(context).getString(KEY_TONE, "") ?: ""

  fun setToneUri(context: Context, uri: String) {
    prefs(context).edit().putString(KEY_TONE, uri).apply()
  }

  /** What the moment should actually play: the chosen tone, else the system's alarm/ringtone default. */
  fun resolvedTone(context: Context): Uri? {
    val chosen = toneUri(context)
    if (chosen.isNotEmpty()) {
      return runCatching { Uri.parse(chosen) }.getOrNull()
    }
    return RingtoneManager.getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_ALARM)
      ?: RingtoneManager.getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_RINGTONE)
      ?: RingtoneManager.getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_NOTIFICATION)
  }

  /** The device's alarm tones, for the settings picker: [{ title, uri }]. */
  fun listTones(context: Context): List<Map<String, String>> {
    val out = mutableListOf<Map<String, String>>()
    for (type in listOf(RingtoneManager.TYPE_ALARM, RingtoneManager.TYPE_NOTIFICATION)) {
      val mgr = RingtoneManager(context).apply { setType(type) }
      runCatching {
        val cursor = mgr.cursor
        while (cursor.moveToNext()) {
          val title = cursor.getString(RingtoneManager.TITLE_COLUMN_INDEX)
          val uri = mgr.getRingtoneUri(cursor.position).toString()
          if (out.none { it["uri"] == uri }) out.add(mapOf("title" to title, "uri" to uri))
        }
      }
    }
    return out
  }

  private fun prefs(context: Context) =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
