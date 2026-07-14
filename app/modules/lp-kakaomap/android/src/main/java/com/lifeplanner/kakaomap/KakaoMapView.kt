package com.lifeplanner.kakaomap

import android.content.Context
import android.view.ViewGroup
import com.kakao.vectormap.KakaoMap
import com.kakao.vectormap.KakaoMapReadyCallback
import com.kakao.vectormap.KakaoMapSdk
import com.kakao.vectormap.LatLng
import com.kakao.vectormap.MapLifeCycleCallback
import com.kakao.vectormap.MapView
import com.kakao.vectormap.camera.CameraUpdateFactory
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

/**
 * The Kakao MapView wrapped as an ExpoView. Lifecycle follows the view's own attach/detach — an ExpoView does
 * not get the Activity's onResume/onPause, so `resume()`/`pause()` are hooked there (good enough for a picker
 * that lives for one screen; a long-lived map would also watch AppState).
 */
class KakaoMapView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val mapView = MapView(context)
  private var kakaoMap: KakaoMap? = null
  private var started = false
  private var pendingCenter: LatLng? = null

  private val onCenterChanged by EventDispatcher()
  private val onMapError by EventDispatcher()

  init {
    mapView.layoutParams =
      ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
    addView(mapView)
  }

  /** Init + start the map — once, when the app key arrives from JS (it is not known at view-construction time). */
  fun setAppKey(key: String) {
    if (started || key.isEmpty()) return
    started = true
    try {
      KakaoMapSdk.init(context, key)
    } catch (e: Exception) {
      // init is a once-per-process call; a repeat throws. Already initialised → carry on.
    }
    mapView.start(
      object : MapLifeCycleCallback() {
        override fun onMapDestroy() {}
        override fun onMapError(error: Exception) {
          this@KakaoMapView.onMapError(mapOf("message" to (error.message ?: "map error")))
        }
      },
      object : KakaoMapReadyCallback() {
        override fun onMapReady(map: KakaoMap) {
          kakaoMap = map
          pendingCenter?.let { moveTo(it) }
          emitCenter()
          map.setOnCameraMoveEndListener { _, position, _ ->
            val p = position.position
            onCenterChanged(mapOf("lat" to p.latitude, "lng" to p.longitude))
          }
        }
      }
    )
  }

  fun setCenter(center: DoubleArray) {
    if (center.size < 2) return
    val ll = LatLng.from(center[0], center[1])
    if (kakaoMap != null) moveTo(ll) else pendingCenter = ll
  }

  private fun moveTo(ll: LatLng) {
    kakaoMap?.moveCamera(CameraUpdateFactory.newCenterPosition(ll))
  }

  private fun emitCenter() {
    val p = kakaoMap?.cameraPosition?.position ?: return
    onCenterChanged(mapOf("lat" to p.latitude, "lng" to p.longitude))
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (started) mapView.resume()
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    if (started) mapView.pause()
  }
}
