package com.lifeplanner.lpalarm

import android.content.Context
import org.json.JSONObject

/**
 * A one-slot handoff from the fired alarm to the RN execution screen, WITHOUT a custom-scheme deep
 * link (the expo-dev-client launcher intercepts those in dev builds). AlarmNotifications writes it on
 * fire; the RN app reads + clears it on launch/resume (LpAlarmModule.consumePendingExecution) and
 * navigates to /execution. Works in dev AND release.
 */
object PendingExecution {
  private const val PREFS = "lp_pending_exec"
  private const val KEY = "item"

  fun put(context: Context, item: AlarmItem, firedAt: Long) {
    val json = JSONObject()
      .put("taskId", item.id)
      .put("title", item.title)
      .put("note", item.note)
      .put("intended", item.fireAt)
      .put("createdAt", item.createdAt)
      .put("firedAt", firedAt)
    prefs(context).edit().putString(KEY, json.toString()).apply()
  }

  /** Returns the pending execution (and clears it), or null. */
  fun consume(context: Context): Map<String, Any>? {
    val raw = prefs(context).getString(KEY, null) ?: return null
    prefs(context).edit().remove(KEY).apply()
    val o = JSONObject(raw)
    return mapOf(
      "taskId" to o.getString("taskId"),
      "title" to o.getString("title"),
      "note" to o.optString("note", ""),
      "intended" to o.getLong("intended").toDouble(),
      "createdAt" to o.getLong("createdAt").toDouble()
    )
  }

  private fun prefs(context: Context) =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
