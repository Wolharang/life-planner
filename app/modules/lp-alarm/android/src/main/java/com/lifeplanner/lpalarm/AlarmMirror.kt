package com.lifeplanner.lpalarm

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Native-owned mirror of scheduled alarms (architecture §9-②). SharedPreferences so a killed /
 * rebooted process can re-arm alarms WITHOUT loading the JS store. This is a derived cache, not the
 * source of truth (§9) — JS write-through on create/edit, evict on delete (no ghost alarms).
 */
object AlarmMirror {
  private const val PREFS = "lp_alarm_mirror"
  private const val KEY = "items"

  fun put(context: Context, item: AlarmItem) {
    val items = getAll(context).filter { it.id != item.id }.toMutableList()
    items.add(item)
    write(context, items)
  }

  fun remove(context: Context, id: String) {
    write(context, getAll(context).filter { it.id != id })
  }

  fun getAll(context: Context): List<AlarmItem> {
    val raw = prefs(context).getString(KEY, "[]") ?: "[]"
    val arr = JSONArray(raw)
    val out = ArrayList<AlarmItem>(arr.length())
    for (i in 0 until arr.length()) {
      val o = arr.getJSONObject(i)
      out.add(
        AlarmItem(
          id = o.getString("id"),
          fireAt = o.getLong("fireAt"),
          title = o.optString("title", "실행"),
          recurrence = o.optString("recurrence", "none"),
          note = o.optString("note", ""),
          createdAt = o.optLong("createdAt", 0L),
          leadMinutes = o.optInt("leadMinutes", 0),
          sound = o.optBoolean("sound", false)
        )
      )
    }
    return out
  }

  private fun write(context: Context, items: List<AlarmItem>) {
    val arr = JSONArray()
    items.forEach {
      arr.put(
        JSONObject()
          .put("id", it.id)
          .put("fireAt", it.fireAt)
          .put("title", it.title)
          .put("recurrence", it.recurrence)
          .put("note", it.note)
          .put("createdAt", it.createdAt)
          .put("leadMinutes", it.leadMinutes)
          .put("sound", it.sound)
      )
    }
    prefs(context).edit().putString(KEY, arr.toString()).apply()
  }

  private fun prefs(context: Context) =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
