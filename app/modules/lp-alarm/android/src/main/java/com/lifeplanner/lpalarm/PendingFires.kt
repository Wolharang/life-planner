package com.lifeplanner.lpalarm

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * "The moment actually appeared" markers, recorded when ExecutionActivity is created (for both an
 * exact fire and a WorkManager catch-up re-fire). Drained by the RN app on open. Serves TWO purposes:
 *  - R6 catch-up: a fire with NO `done` outcome for its date = "fired but not done" (→ 아직 안 했죠).
 *  - S1 measurability: carries `deltaMs` (firedAt − intended = actual fire latency).
 */
object PendingFires {
  private const val PREFS = "lp_pending_fires"
  private const val KEY = "list"

  fun record(context: Context, taskId: String, title: String, date: String, intended: Long, firedAt: Long) {
    val arr = JSONArray(prefs(context).getString(KEY, "[]"))
    arr.put(
      JSONObject()
        .put("taskId", taskId)
        .put("title", title)
        .put("date", date)
        .put("intended", intended)
        .put("firedAt", firedAt)
        .put("deltaMs", firedAt - intended)
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
          "intended" to o.getLong("intended").toDouble(),
          "firedAt" to o.getLong("firedAt").toDouble(),
          "deltaMs" to o.getLong("deltaMs").toDouble()
        )
      )
    }
    return out
  }

  private fun prefs(context: Context) =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
