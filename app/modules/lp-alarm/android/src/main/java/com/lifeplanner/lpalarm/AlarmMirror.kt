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

  /**
   * Never throws. `JSONArray(raw)` and `getString("id")` throw `JSONException` on a malformed or older entry,
   * and `getAll` sits under `AlarmScheduler.cancel` → `AlarmMirror.remove`, which JS calls with **no try/catch**
   * from `scheduleBlock`/`unscheduleBlock`. One bad row in SharedPreferences would therefore blow up **every
   * save, edit and delete in the app**. A derived cache must degrade, not detonate: an unreadable row is simply
   * not there.
   */
  fun getAll(context: Context): List<AlarmItem> {
    val raw = prefs(context).getString(KEY, "[]") ?: "[]"
    val arr = try {
      JSONArray(raw)
    } catch (e: Exception) {
      return emptyList()
    }
    val out = ArrayList<AlarmItem>(arr.length())
    for (i in 0 until arr.length()) {
      val o = arr.optJSONObject(i) ?: continue
      if (!o.has("id") || !o.has("fireAt")) continue
      out.add(
        AlarmItem(
          id = o.optString("id"),
          fireAt = o.optLong("fireAt"),
          title = o.optString("title", "실행"),
          recurrence = o.optString("recurrence", "none"),
          note = o.optString("note", ""),
          createdAt = o.optLong("createdAt", 0L),
          leadMinutes = o.optInt("leadMinutes", 0),
          sound = o.optBoolean("sound", false),
          // `mode` was NOT persisted. A re-arm from the mirror therefore rebuilt every alarm as a
          // "commit", so a re-check restored after a reboot would have re-opened as a full execution
          // moment for a block the user had already committed to.
          mode = o.optString("mode", "commit"),
          occurrenceDate = o.optString("occurrenceDate", ""),
          wallDate = o.optString("wallDate", ""),
          wallMinute = o.optInt("wallMinute", -1),
          vibrate = o.optBoolean("vibrate", true)
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
          .put("mode", it.mode)
          .put("occurrenceDate", it.occurrenceDate)
          .put("wallDate", it.wallDate)
          .put("wallMinute", it.wallMinute)
          .put("vibrate", it.vibrate)
      )
    }
    prefs(context).edit().putString(KEY, arr.toString()).apply()
  }

  private fun prefs(context: Context) =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
