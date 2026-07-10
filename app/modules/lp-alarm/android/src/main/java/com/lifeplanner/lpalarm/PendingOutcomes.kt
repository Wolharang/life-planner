package com.lifeplanner.lpalarm

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Outcomes recorded by the native execution moment (which runs over the lock screen without any JS).
 * Appended here (SharedPreferences); the RN app drains them into its outcome store on next open
 * (LpAlarmModule.consumePendingOutcomes → home). Keeps S2 (source = execution-screen) measurable.
 */
object PendingOutcomes {
  private const val PREFS = "lp_pending_outcomes"
  private const val KEY = "list"

  fun record(context: Context, taskId: String, title: String, date: String, status: String, at: Long) {
    val arr = JSONArray(prefs(context).getString(KEY, "[]"))
    arr.put(
      JSONObject().put("taskId", taskId).put("title", title).put("date", date).put("status", status).put("at", at)
    )
    prefs(context).edit().putString(KEY, arr.toString()).apply()
  }

  fun consume(context: Context): List<Map<String, Any>> {
    val raw = prefs(context).getString(KEY, "[]") ?: "[]"
    prefs(context).edit().remove(KEY).apply()
    val arr = JSONArray(raw)
    val out = ArrayList<Map<String, Any>>(arr.length())
    for (i in 0 until arr.length()) {
      val o = arr.getJSONObject(i)
      out.add(
        mapOf(
          "taskId" to o.getString("taskId"),
          "title" to o.optString("title", ""),
          "date" to o.getString("date"),
          "status" to o.getString("status"),
          "at" to o.getLong("at").toDouble()
        )
      )
    }
    return out
  }

  private fun prefs(context: Context) =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
