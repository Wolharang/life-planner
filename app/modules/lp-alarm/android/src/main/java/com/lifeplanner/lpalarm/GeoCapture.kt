package com.lifeplanner.lpalarm

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.Build
import androidx.core.content.ContextCompat

/**
 * One best-effort location fix → PendingGeo. **Silent on every failure** — no permission, no enabled provider,
 * no fix — because auto-eval simply abstains and the user judges by hand. Uses the framework `LocationManager`
 * (no Play Services dependency in this module).
 */
object GeoCapture {

  fun hasPermission(context: Context): Boolean =
    ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
      PackageManager.PERMISSION_GRANTED ||
    ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) ==
      PackageManager.PERMISSION_GRANTED

  /**
   * @param onDone invoked once the fix has been stored (or determined impossible) — a receiver uses it to end
   *   its `goAsync()`. May be called synchronously (old API / early return) or asynchronously (getCurrentLocation).
   */
  fun captureInto(context: Context, blockId: String, date: String, onDone: (() -> Unit)? = null) {
    val app = context.applicationContext
    if (!hasPermission(app)) { onDone?.invoke(); return }
    val lm = app.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
    if (lm == null) { onDone?.invoke(); return }

    val provider = when {
      lm.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
      lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
      else -> { onDone?.invoke(); return }
    }

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        lm.getCurrentLocation(provider, null, app.mainExecutor) { loc ->
          if (loc != null) {
            PendingGeo.append(app, blockId, date, loc.latitude, loc.longitude, System.currentTimeMillis())
          }
          onDone?.invoke()
        }
      } else {
        @Suppress("DEPRECATION")
        val loc = lm.getLastKnownLocation(provider)
        if (loc != null) {
          PendingGeo.append(app, blockId, date, loc.latitude, loc.longitude, System.currentTimeMillis())
        }
        onDone?.invoke()
      }
    } catch (e: SecurityException) {
      onDone?.invoke()
    }
  }
}
