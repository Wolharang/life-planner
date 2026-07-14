package com.lifeplanner.kakaomap

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * A local Expo **view** module wrapping the Kakao Maps SDK v2 (com.kakao.vectormap.MapView). The app renders it
 * through `requireNativeViewManager('LpKakaoMap')` (app/src/core/geo/KakaoMap.tsx) and uses it to pick a gym.
 *
 * Props:  · appKey (String)  — the Kakao native app key; init + start happen once it arrives.
 *         · center ([lat,lng]) — moves the camera centre (the fixed on-screen pin marks it).
 * Events: · onCenterChanged {lat,lng} — fires when the map settles after a pan (and once when ready).
 *         · onMapError {message}      — auth/SDK failure, so JS can fall back.
 */
class KakaoMapModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LpKakaoMap")

    View(KakaoMapView::class) {
      Events("onCenterChanged", "onMapError")

      Prop("appKey") { view: KakaoMapView, key: String ->
        view.setAppKey(key)
      }
      Prop("center") { view: KakaoMapView, center: DoubleArray ->
        view.setCenter(center)
      }
    }
  }
}
