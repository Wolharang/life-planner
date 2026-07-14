package com.lifeplanner.lpalarm

import android.content.Context

/**
 * Which block ids are workout/run **실행** blocks that auto-evaluate by location.
 *
 * Set by JS at schedule time (it knows the block's kind and tier); read natively when the moment is committed,
 * so the GPS capture can start with no JS process alive. A plain id→bool set — the whole coupling between the
 * feature's JS brain and its native hands.
 */
object AutoEvalRegistry {
  private const val PREFS = "lp_autoeval"

  fun set(context: Context, blockId: String, on: Boolean) {
    prefs(context).edit().apply {
      if (on) putBoolean(blockId, true) else remove(blockId)
    }.apply()
  }

  fun isOn(context: Context, blockId: String): Boolean = prefs(context).getBoolean(blockId, false)

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
