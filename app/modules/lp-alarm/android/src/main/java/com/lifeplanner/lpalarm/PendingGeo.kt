package com.lifeplanner.lpalarm

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * GPS fixes captured by the native auto-evaluation (workout/run 실행 blocks), keyed by "blockId|date".
 *
 * Appended as they arrive — at commit ("응, 할게"), +5m, +15m — even while the app is dead. The RN app drains
 * and **evaluates** them on next open, then clears each occurrence. The RAW coordinates never leave the phone:
 * JS turns the three fixes into a single 성공/실패 (the block's status) and discards them here.
 */
object PendingGeo {
  private const val PREFS = "lp_pending_geo"

  fun append(context: Context, blockId: String, date: String, lat: Double, lng: Double, at: Long) {
    val key = "$blockId|$date"
    val arr = JSONArray(prefs(context).getString(key, "[]"))
    arr.put(JSONObject().put("lat", lat).put("lng", lng).put("at", at))
    prefs(context).edit().putString(key, arr.toString()).apply()
  }

  /** Every occurrence's samples. Does NOT clear — JS clears each occurrence once it has applied a verdict. */
  fun snapshot(context: Context): List<Map<String, Any>> {
    val out = ArrayList<Map<String, Any>>()
    for ((key, value) in prefs(context).all) {
      val parts = key.split("|")
      if (parts.size != 2) continue
      val arr = JSONArray(value as? String ?: "[]")
      val samples = ArrayList<Map<String, Any>>(arr.length())
      for (i in 0 until arr.length()) {
        val o = arr.getJSONObject(i)
        samples.add(
          mapOf("lat" to o.getDouble("lat"), "lng" to o.getDouble("lng"), "at" to o.getLong("at").toDouble())
        )
      }
      out.add(mapOf("blockId" to parts[0], "date" to parts[1], "samples" to samples))
    }
    return out
  }

  fun clear(context: Context, blockId: String, date: String) {
    prefs(context).edit().remove("$blockId|$date").apply()
  }

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
