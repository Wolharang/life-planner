package com.lifeplanner.lpalarm

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

/**
 * Occurrences whose effective time passed without the exact alarm presenting the execution moment.
 * Drained by RN into the R6 catch-up surface as the gentle "놓쳤어요 — 지금이라도?" path.
 */
object PendingMisses {
  private const val PREFS = "lp_pending_misses"
  private const val KEY = "list"

  fun record(context: Context, item: AlarmItem, missedAt: Long) {
    val date = occurrenceDate(item)
    val arr = JSONArray(prefs(context).getString(KEY, "[]"))
    val key = item.id + "|" + date
    for (i in 0 until arr.length()) {
      val o = arr.getJSONObject(i)
      if (o.optString("taskId") + "|" + o.optString("date") == key) return
    }
    arr.put(
      JSONObject()
        .put("taskId", item.id)
        .put("title", item.title)
        .put("date", date)
        .put("intended", item.fireAt)
        .put("missedAt", missedAt)
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
          "missedAt" to o.getLong("missedAt").toDouble()
        )
      )
    }
    return out
  }

  private fun occurrenceDate(item: AlarmItem): String {
    val c = Calendar.getInstance().apply {
      timeInMillis = item.fireAt + item.leadMinutes * 60_000L
    }
    return String.format(
      "%04d-%02d-%02d",
      c.get(Calendar.YEAR),
      c.get(Calendar.MONTH) + 1,
      c.get(Calendar.DAY_OF_MONTH)
    )
  }

  private fun prefs(context: Context) =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
