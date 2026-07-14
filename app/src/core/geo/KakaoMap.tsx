// RN wrapper for the local Kakao map view module (modules/lp-kakaomap). Kept behind /core/geo so screens don't
// touch the native surface directly. If the native view isn't linked (dev skew / no Kakao key), `available` is
// false and the caller falls back to the OSM map.

import { requireNativeViewManager } from "expo-modules-core";
import * as React from "react";
import type { ViewProps } from "react-native";
import type { GeoPoint } from "@/core/schedule/autoEval";

export type KakaoMapProps = ViewProps & {
  /** Kakao native app key. Init + start happen once it arrives. */
  appKey: string;
  /** Camera centre [lat, lng]. Change it to move the map (the on-screen pin marks it). */
  center: [number, number];
  onCenterChanged?: (e: { nativeEvent: GeoPoint }) => void;
  /** Fires when the camera STARTS moving (a pan/zoom begins). */
  onMoveStart?: (e: { nativeEvent: Record<string, never> }) => void;
  onMapError?: (e: { nativeEvent: { message: string } }) => void;
};

let NativeView: React.ComponentType<KakaoMapProps> | null = null;
try {
  NativeView = requireNativeViewManager("LpKakaoMap");
} catch {
  NativeView = null; // module not linked in this binary — the OSM fallback is used instead
}

export const kakaoMapAvailable = NativeView != null;

export function KakaoMap(props: KakaoMapProps) {
  if (!NativeView) return null;
  return <NativeView {...props} />;
}
